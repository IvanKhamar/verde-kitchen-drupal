<?php

declare(strict_types=1);

namespace Drupal\Tests\verde_leads\Kernel;

use Drupal\Core\Queue\DelayedRequeueException;
use Drupal\KernelTests\KernelTestBase;
use Drupal\verde_leads\Entity\Lead;
use Drupal\verde_leads\LeadForwarder;
use Drupal\verde_leads\LeadIntake;
use Drupal\verde_leads\LeadStatus;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;

/**
 * Forwarding to LeadTriage: each answer of the intake contract.
 *
 * The HTTP client is a Guzzle MockHandler, so no request leaves the test.
 */
#[Group('verde_leads')]
final class LeadForwardingTest extends KernelTestBase {

  /**
   * {@inheritdoc}
   */
  protected static $modules = ['system', 'options', 'path_alias', 'verde_leads'];

  /**
   * Requests the mocked client received.
   *
   * @var array<int, array{request: \Psr\Http\Message\RequestInterface}>
   */
  private array $history = [];

  /**
   * The mocked answers, in order.
   */
  private MockHandler $mock;

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('verde_lead');
    $this->installConfig(['verde_leads']);
    $this->setSetting('verde_leads_url', 'http://leadtriage.test/');
    $this->setSetting('verde_leads_token', 'test-token-not-a-secret');

    $this->mock = new MockHandler();
    $stack = HandlerStack::create($this->mock);
    $stack->push(Middleware::history($this->history));
    $this->container->set('http_client', new Client(['handler' => $stack]));
  }

  /**
   * A saved message, as the form would save it.
   */
  private function lead(array $values = []): Lead {
    return $this->container->get(LeadIntake::class)->receive($values + [
      'name' => 'Olena Test',
      'email' => 'olena@example.com',
      'phone' => '+380501234567',
      'message' => 'Do you deliver to Lviv? We run a small cafe.',
      'locale' => 'uk',
      'page_url' => 'https://verde.example.com/uk/contact',
    ]);
  }

  /**
   * Runs the queue worker on the message; returns the requeue delay, if any.
   */
  private function process(Lead $lead): ?int {
    $worker = $this->container->get('plugin.manager.queue_worker')->createInstance('verde_leads_forward');
    try {
      $worker->processItem(['id' => $lead->id()]);
      return NULL;
    }
    catch (DelayedRequeueException $e) {
      return $e->getDelay();
    }
  }

  /**
   * The request follows the contract: URL, token header and JSON body.
   */
  public function testRequestMatchesTheContract(): void {
    $this->mock->append(new Response(202, [], '{"status":"received","leadId":"L1"}'));
    $lead = $this->lead();
    $this->process($lead);

    $this->assertCount(1, $this->history);
    $request = $this->history[0]['request'];
    $this->assertSame('POST', $request->getMethod());
    $this->assertSame('http://leadtriage.test/api/sources/verde-kitchen/leads', (string) $request->getUri());
    $this->assertSame('test-token-not-a-secret', $request->getHeaderLine('X-Source-Token'));

    $body = json_decode((string) $request->getBody(), TRUE);
    $this->assertSame([
      'externalId', 'name', 'email', 'phone', 'message', 'consent', 'locale', 'pageUrl', 'submittedAt',
    ], array_keys($body));
    $this->assertSame('verde-kitchen:contact:' . $lead->id(), $body['externalId']);
    $this->assertTrue($body['consent']);
    $this->assertSame('uk', $body['locale']);
    // ISO 8601 with a time zone.
    $this->assertMatchesRegularExpression('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/', $body['submittedAt']);
  }

  /**
   * An empty phone number is left out, as the contract allows.
   */
  public function testOptionalPhoneIsLeftOut(): void {
    $payload = $this->container->get(LeadForwarder::class)->payload($this->lead(['phone' => '']));
    $this->assertArrayNotHasKey('phone', $payload);
  }

  /**
   * Final answers: the status changes and the item leaves the queue.
   */
  #[DataProvider('finalAnswers')]
  public function testFinalAnswers(int $code, string $body, LeadStatus $expected, ?string $error): void {
    $this->mock->append(new Response($code, [], $body));
    $lead = $this->lead();
    $this->assertNull($this->process($lead));

    $lead = Lead::load($lead->id());
    $this->assertSame($expected, $lead->getStatus());
    $this->assertSame(1, (int) $lead->get('attempts')->value);
    $this->assertSame($error, $lead->get('last_error')->value);
  }

  /**
   * Data for testFinalAnswers().
   */
  public static function finalAnswers(): array {
    return [
      'received' => [202, '{"status":"received","leadId":"L1"}', LeadStatus::Sent, NULL],
      'duplicate' => [200, '{"status":"duplicate","leadId":"L1"}', LeadStatus::Duplicate, NULL],
      'invalid' => [400, '{"title":"Validation error","errors":["email"]}', LeadStatus::Failed, '400'],
    ];
  }

  /**
   * Temporary errors: retried later with a growing pause.
   */
  #[DataProvider('temporaryErrors')]
  public function testTemporaryErrorsAreRetried(int $code, string $error): void {
    $this->mock->append($code ? new Response($code) : new ConnectException('Connection refused', new Request('POST', 'http://leadtriage.test')));
    $lead = $this->lead();
    $this->assertSame(LeadForwarder::RETRY_DELAYS[0], $this->process($lead));

    $lead = Lead::load($lead->id());
    $this->assertSame(LeadStatus::Pending, $lead->getStatus());
    $this->assertSame(1, (int) $lead->get('attempts')->value);
    $this->assertSame($error, $lead->get('last_error')->value);
    $this->assertGreaterThan(\Drupal::time()->getRequestTime(), (int) $lead->get('next_attempt')->value);

    // Before the pause is over the worker does not call LeadTriage again.
    $this->assertGreaterThan(0, $this->process($lead));
    $this->assertCount(1, $this->history);
  }

  /**
   * Data for testTemporaryErrorsAreRetried(); code 0 is a network error.
   */
  public static function temporaryErrors(): array {
    return [
      'unavailable' => [503, '503'],
      'rate limited' => [429, '429'],
      'too large' => [413, '413'],
      'network' => [0, 'network'],
    ];
  }

  /**
   * After the last attempt the message is marked failed.
   */
  public function testGivesUpAfterMaxAttempts(): void {
    $this->mock->append(new Response(503));
    $lead = $this->lead();
    $lead->set('attempts', LeadForwarder::MAX_ATTEMPTS - 1)->save();
    $this->assertNull($this->process($lead));
    $this->assertSame(LeadStatus::Failed, Lead::load($lead->id())->getStatus());
  }

  /**
   * A wrong token keeps the message waiting and warns the admin.
   */
  public function testWrongTokenKeepsTheMessage(): void {
    $this->mock->append(new Response(401));
    $lead = $this->lead();
    $this->assertSame(LeadForwarder::AUTH_RETRY_DELAY, $this->process($lead));

    $lead = Lead::load($lead->id());
    $this->assertSame(LeadStatus::Pending, $lead->getStatus());
    // Not counted as an attempt: the message itself is fine.
    $this->assertSame(0, (int) $lead->get('attempts')->value);
    $this->assertNotNull($this->container->get('state')->get(LeadForwarder::AUTH_FAILED_STATE));

    // The next success clears the warning.
    $lead->set('next_attempt', NULL)->save();
    $this->mock->append(new Response(202, [], '{"status":"received"}'));
    $this->process($lead);
    $this->assertNull($this->container->get('state')->get(LeadForwarder::AUTH_FAILED_STATE));
  }

  /**
   * A saved message goes into the queue; a retried one goes in again.
   */
  public function testQueueAndRetry(): void {
    $queue = $this->container->get('queue')->get(LeadIntake::QUEUE);
    $lead = $this->lead();
    $this->assertSame(1, $queue->numberOfItems());

    $lead->setStatus(LeadStatus::Failed)->set('attempts', 8)->save();
    $this->container->get(LeadIntake::class)->retry($lead);
    $lead = Lead::load($lead->id());
    $this->assertSame(LeadStatus::Pending, $lead->getStatus());
    $this->assertSame(0, (int) $lead->get('attempts')->value);
    $this->assertSame(2, $queue->numberOfItems());
  }

  /**
   * If the URL is removed later, waiting messages are not forwarded.
   */
  public function testNoUrlMeansNotForwarded(): void {
    $lead = $this->lead();
    $this->setSetting('verde_leads_url', '');
    $this->assertNull($this->process($lead));
    $this->assertSame(LeadStatus::NotForwarded, Lead::load($lead->id())->getStatus());
    $this->assertCount(0, $this->history);
  }

}
