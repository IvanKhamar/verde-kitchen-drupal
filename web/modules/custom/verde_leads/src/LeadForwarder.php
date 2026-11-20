<?php

declare(strict_types=1);

namespace Drupal\verde_leads;

use Drupal\Component\Datetime\TimeInterface;
use Drupal\Core\Site\Settings;
use Drupal\Core\State\StateInterface;
use Drupal\verde_leads\Entity\Lead;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\RequestOptions;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Sends one contact message to LeadTriage (lead intake contract v1).
 *
 * The answer decides what happens next (docs/phase-10-contact-form.md):
 * - 202 received, 200 duplicate: done;
 * - 400: rejected for good, no retry;
 * - 401: wrong token; the message waits, an admin is warned;
 * - 413, 429, 5xx, timeout, network error: retry later, with a growing pause.
 *
 * Logs hold the message id, status and HTTP code only, never personal data.
 */
final class LeadForwarder {

  /**
   * Pause before attempt 2, 3, ... (seconds): about a day in total.
   */
  public const RETRY_DELAYS = [60, 300, 900, 3600, 7200, 14400, 28800];

  /**
   * After this many failed attempts the message is marked failed.
   */
  public const MAX_ATTEMPTS = 8;

  /**
   * Pause after a 401 (wrong token): an admin has to fix the token first.
   */
  public const AUTH_RETRY_DELAY = 3600;

  /**
   * State key: time of the last 401 answer, shown on the admin page.
   */
  public const AUTH_FAILED_STATE = 'verde_leads.auth_failed';

  public function __construct(
    private readonly ClientInterface $httpClient,
    private readonly Settings $settings,
    private readonly TimeInterface $time,
    private readonly StateInterface $state,
    #[Autowire(service: 'logger.channel.verde_leads')]
    private readonly LoggerInterface $logger,
  ) {}

  /**
   * The JSON body for LeadTriage.
   *
   * @return array<string, mixed>
   *   The payload.
   */
  public function payload(Lead $lead): array {
    $submitted = (new \DateTimeImmutable('@' . $lead->get('created')->value))
      ->setTimezone(new \DateTimeZone(date_default_timezone_get()));
    return array_filter([
      'externalId' => $lead->externalId(),
      'name' => $lead->get('name')->value,
      'email' => $lead->get('email')->value,
      'phone' => $lead->get('phone')->value ?: NULL,
      'message' => $lead->get('message')->value,
      'consent' => (bool) $lead->get('consent')->value,
      'locale' => $lead->get('locale')->value,
      'pageUrl' => $lead->get('page_url')->value ?: NULL,
      'submittedAt' => $submitted->format(\DATE_ATOM),
    ], fn ($value) => $value !== NULL);
  }

  /**
   * Sends the message and saves its new status.
   *
   * @return int|null
   *   Seconds to wait before the next attempt, or NULL when there is nothing
   *   more to do (sent, duplicate, failed or not forwarded).
   */
  public function forward(Lead $lead): ?int {
    $url = rtrim((string) $this->settings->get('verde_leads_url', ''), '/');
    if ($url === '') {
      $lead->setStatus(LeadStatus::NotForwarded)->save();
      return NULL;
    }

    try {
      $response = $this->httpClient->request('POST', $url . '/api/sources/verde-kitchen/leads', [
        RequestOptions::JSON => $this->payload($lead),
        RequestOptions::HEADERS => [
          'X-Source-Token' => (string) $this->settings->get('verde_leads_token', ''),
          'Accept' => 'application/json',
        ],
        RequestOptions::CONNECT_TIMEOUT => 5,
        RequestOptions::TIMEOUT => 15,
        // Every status code is handled below, not thrown.
        RequestOptions::HTTP_ERRORS => FALSE,
      ]);
      $code = $response->getStatusCode();
      $body = json_decode((string) $response->getBody(), TRUE);
    }
    catch (GuzzleException) {
      // Timeout or network error. The exception text can contain the URL, so
      // only its kind is kept.
      return $this->retryLater($lead, 'network');
    }

    if ($code === 202 || ($code === 200 && ($body['status'] ?? '') === 'duplicate')) {
      $status = $code === 202 ? LeadStatus::Sent : LeadStatus::Duplicate;
      return $this->finish($lead, $status, $code);
    }
    if ($code === 400) {
      return $this->finish($lead, LeadStatus::Failed, $code);
    }
    if ($code === 401) {
      $this->state->set(self::AUTH_FAILED_STATE, $this->time->getRequestTime());
      $lead->set('last_error', '401')
        ->set('next_attempt', $this->time->getRequestTime() + self::AUTH_RETRY_DELAY)
        ->save();
      $this->logger->warning('Contact message @id: LeadTriage refused the source token (HTTP 401). Check VERDE_LEADS_TOKEN.', ['@id' => $lead->id()]);
      return self::AUTH_RETRY_DELAY;
    }
    return $this->retryLater($lead, (string) $code);
  }

  /**
   * Saves a final status.
   */
  private function finish(Lead $lead, LeadStatus $status, int $code): ?int {
    $lead->setStatus($status)
      ->set('attempts', (int) $lead->get('attempts')->value + 1)
      ->set('last_error', $status === LeadStatus::Failed ? (string) $code : NULL)
      ->set('next_attempt', NULL)
      ->set('sent', $status === LeadStatus::Failed ? NULL : $this->time->getRequestTime())
      ->save();
    if ($status !== LeadStatus::Failed) {
      // A working token again: the admin warning can go.
      $this->state->delete(self::AUTH_FAILED_STATE);
    }
    $this->logger->info('Contact message @id: @status (HTTP @code).', [
      '@id' => $lead->id(),
      '@status' => $status->value,
      '@code' => $code,
    ]);
    return NULL;
  }

  /**
   * Counts a failed attempt and plans the next one, or gives up.
   */
  private function retryLater(Lead $lead, string $error): ?int {
    $attempts = (int) $lead->get('attempts')->value + 1;
    $lead->set('attempts', $attempts)->set('last_error', $error);

    if ($attempts >= self::MAX_ATTEMPTS) {
      $lead->setStatus(LeadStatus::Failed)->set('next_attempt', NULL)->save();
      $this->logger->error('Contact message @id: failed after @attempts attempts (last error @error).', [
        '@id' => $lead->id(),
        '@attempts' => $attempts,
        '@error' => $error,
      ]);
      return NULL;
    }

    $delay = self::RETRY_DELAYS[min($attempts, count(self::RETRY_DELAYS)) - 1];
    $lead->set('next_attempt', $this->time->getRequestTime() + $delay)->save();
    $this->logger->notice('Contact message @id: attempt @attempts failed (@error), next in @delay s.', [
      '@id' => $lead->id(),
      '@attempts' => $attempts,
      '@error' => $error,
      '@delay' => $delay,
    ]);
    return $delay;
  }

}
