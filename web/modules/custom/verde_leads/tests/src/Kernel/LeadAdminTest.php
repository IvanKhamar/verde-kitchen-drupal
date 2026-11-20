<?php

declare(strict_types=1);

namespace Drupal\Tests\verde_leads\Kernel;

use Drupal\KernelTests\KernelTestBase;
use Drupal\Tests\user\Traits\UserCreationTrait;
use Drupal\verde_leads\Entity\Lead;
use Drupal\verde_leads\Hook\LeadsHooks;
use PHPUnit\Framework\Attributes\Group;

/**
 * The admin list and the retention clean-up.
 */
#[Group('verde_leads')]
final class LeadAdminTest extends KernelTestBase {

  use UserCreationTrait;

  /**
   * {@inheritdoc}
   */
  protected static $modules = ['system', 'user', 'options', 'path_alias', 'verde_leads'];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    $this->installEntitySchema('verde_lead');
    // Operation links are URLs, and URLs look up path aliases.
    $this->installEntitySchema('path_alias');
    $this->installConfig(['system', 'verde_leads']);
    // User 1 has every permission; take that id before the test users.
    $this->createUser();
  }

  /**
   * HTML in a message is shown as text on the admin list.
   */
  public function testAdminListEscapesHtml(): void {
    $this->setUpCurrentUser([], ['view contact messages']);
    Lead::create([
      'name' => '<script>alert(1)</script> Test',
      'email' => 'test@example.com',
      'message' => 'Hello there, any news?',
    ])->save();

    $build = $this->container->get('entity_type.manager')->getListBuilder('verde_lead')->render();
    $html = (string) $this->container->get('renderer')->renderInIsolation($build);
    $this->assertStringContainsString('&lt;script&gt;alert(1)&lt;/script&gt; Test', $html);
    $this->assertStringNotContainsString('<script>alert(1)</script>', $html);
    // Forwarding is off in tests, and the list says so.
    $this->assertStringContainsString('VERDE_LEADS_URL is not set', $html);
  }

  /**
   * Only users with the permission may see the messages.
   */
  public function testAccess(): void {
    $lead = Lead::create(['name' => 'Olena', 'email' => 'o@example.com', 'message' => 'Hello there!']);
    $lead->save();
    $this->assertFalse($lead->access('view', $this->createUser()));
    $this->assertTrue($lead->access('view', $this->createUser(['view contact messages'])));
  }

  /**
   * The newest message comes first.
   */
  public function testNewestFirst(): void {
    $now = $this->container->get('datetime.time')->getRequestTime();
    foreach (['Older' => $now - 7200, 'Newest' => $now, 'Middle' => $now - 3600] as $name => $created) {
      Lead::create(['name' => $name, 'email' => 'x@example.com', 'message' => 'A message.', 'created' => $created])->save();
    }
    $leads = $this->container->get('entity_type.manager')->getListBuilder('verde_lead')->load();
    $this->assertSame(['Newest', 'Middle', 'Older'], array_values(array_map(fn ($lead) => $lead->get('name')->value, $leads)));
  }

  /**
   * Cron deletes messages older than retention_days, and keeps newer ones.
   */
  public function testRetention(): void {
    $now = $this->container->get('datetime.time')->getRequestTime();
    $message = fn (string $name, int $days_ago): Lead => Lead::create([
      'name' => $name,
      'email' => 'test@example.com',
      'message' => 'A test message.',
      'created' => $now - $days_ago * 86400,
    ]);
    $old = $message('Old', 31);
    $old->save();
    $new = $message('New', 29);
    $new->save();

    $this->container->get(LeadsHooks::class)->deleteOldMessages();
    $this->assertNull(Lead::load($old->id()));
    $this->assertNotNull(Lead::load($new->id()));
  }

}
