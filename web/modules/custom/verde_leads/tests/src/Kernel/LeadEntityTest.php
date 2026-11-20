<?php

declare(strict_types=1);

namespace Drupal\Tests\verde_leads\Kernel;

use Drupal\Core\Site\Settings;
use Drupal\KernelTests\KernelTestBase;
use Drupal\verde_leads\Entity\Lead;
use Drupal\verde_leads\LeadStatus;
use PHPUnit\Framework\Attributes\Group;

/**
 * Storage of contact messages and the module's settings.
 */
#[Group('verde_leads')]
final class LeadEntityTest extends KernelTestBase {

  /**
   * {@inheritdoc}
   */
  protected static $modules = ['options', 'verde_leads'];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('verde_lead');
    $this->installConfig(['verde_leads']);
  }

  /**
   * A new message is pending, with no attempts, and keeps its fields.
   */
  public function testNewMessageDefaults(): void {
    $lead = Lead::create([
      'name' => 'Olena Test',
      'email' => 'olena@example.com',
      'message' => 'Do you deliver to Lviv? We run a small cafe.',
      'consent' => TRUE,
      'locale' => 'uk',
    ]);
    $lead->save();

    $loaded = Lead::load($lead->id());
    $this->assertSame(LeadStatus::Pending, $loaded->getStatus());
    $this->assertSame(0, (int) $loaded->get('attempts')->value);
    $this->assertSame('olena@example.com', $loaded->get('email')->value);
    $this->assertSame('verde-kitchen:contact:' . $lead->id(), $loaded->externalId());
    // The label never contains personal data.
    $this->assertStringNotContainsString('Olena', $loaded->label());
  }

  /**
   * The status field accepts exactly the values of the LeadStatus enum.
   */
  public function testStatusValues(): void {
    $allowed = Lead::create([])->getFieldDefinition('status')->getSetting('allowed_values');
    $this->assertSame(array_column(LeadStatus::cases(), 'value'), array_keys($allowed));
  }

  /**
   * Settings come from configuration; URL and token only from settings.php.
   */
  public function testSettings(): void {
    $config = $this->config('verde_leads.settings');
    $this->assertSame(30, $config->get('retention_days'));
    $this->assertSame(5, $config->get('flood.limit'));
    $this->assertNull($config->get('token'));
    // Without environment variables, forwarding is off.
    $this->assertSame('', Settings::get('verde_leads_url', ''));
  }

}
