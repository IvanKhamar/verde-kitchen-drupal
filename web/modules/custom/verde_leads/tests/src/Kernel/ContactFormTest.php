<?php

declare(strict_types=1);

namespace Drupal\Tests\verde_leads\Kernel;

use Drupal\Core\Form\FormState;
use Drupal\KernelTests\KernelTestBase;
use Drupal\verde_leads\Entity\Lead;
use Drupal\verde_leads\Form\ContactForm;
use Drupal\verde_leads\LeadStatus;
use PHPUnit\Framework\Attributes\Group;

/**
 * The contact form, submitted the way Form API does it.
 */
#[Group('verde_leads')]
final class ContactFormTest extends KernelTestBase {

  /**
   * {@inheritdoc}
   */
  protected static $modules = ['system', 'user', 'options', 'path_alias', 'verde_leads'];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('verde_lead');
    $this->installEntitySchema('path_alias');
    $this->installConfig(['verde_leads']);
  }

  /**
   * Submits the form with valid values plus $overrides; returns the errors.
   *
   * @return array<string, string>
   *   Error messages keyed by field name ('' for the whole form).
   */
  private function submit(array $overrides = []): array {
    $form_state = (new FormState())->setValues($overrides + [
      'name' => 'Olena Test',
      'email' => 'olena@example.com',
      'phone' => '',
      'message' => 'Do you deliver to Lviv? We run a small cafe.',
      'consent' => 1,
      'website' => '',
    ]);
    $this->container->get('form_builder')->submitForm(ContactForm::class, $form_state);
    return array_map('strval', $form_state->getErrors());
  }

  /**
   * All saved messages.
   *
   * @return \Drupal\verde_leads\Entity\Lead[]
   *   The messages.
   */
  private function leads(): array {
    return Lead::loadMultiple();
  }

  /**
   * A valid message is saved; without a LeadTriage URL it is not forwarded.
   */
  public function testValidMessageIsSaved(): void {
    $this->assertSame([], $this->submit(['phone' => '+380 50 123 45 67']));
    $leads = $this->leads();
    $this->assertCount(1, $leads);
    $lead = reset($leads);
    $this->assertSame(LeadStatus::NotForwarded, $lead->getStatus());
    $this->assertSame('Olena Test', $lead->get('name')->value);
    $this->assertSame('+380 50 123 45 67', $lead->get('phone')->value);
    $this->assertSame('en', $lead->get('locale')->value);
    $this->assertTrue((bool) $lead->get('consent')->value);
    $this->assertStringEndsWith('/contact', $lead->get('page_url')->value);
  }

  /**
   * With a LeadTriage URL the message waits for forwarding.
   */
  public function testPendingWhenForwardingIsOn(): void {
    $this->setSetting('verde_leads_url', 'http://leadtriage.test');
    $this->submit();
    $leads = $this->leads();
    $this->assertSame(LeadStatus::Pending, reset($leads)->getStatus());
  }

  /**
   * Server-side checks follow the intake contract.
   */
  public function testValidation(): void {
    $errors = $this->submit([
      'name' => 'O',
      'phone' => 'call me',
      'message' => 'Too short',
      // An unchecked checkbox sends nothing (NULL); any value means "checked".
      'consent' => NULL,
    ]);
    $this->assertEqualsCanonicalizing(['name', 'phone', 'message', 'consent'], array_keys($errors));
    $this->assertSame([], $this->leads());

    $errors = $this->submit(['message' => str_repeat('a', Lead::MESSAGE_MAX + 1)]);
    $this->assertArrayHasKey('message', $errors);
  }

  /**
   * A filled honeypot looks like success, but nothing is saved.
   */
  public function testHoneypot(): void {
    $this->assertSame([], $this->submit(['website' => 'https://spam.example.com']));
    $this->assertSame([], $this->leads());
  }

  /**
   * After the flood limit, the form refuses more messages from the same IP.
   */
  public function testFloodLimit(): void {
    $this->config('verde_leads.settings')->set('flood.limit', 2)->save();
    $this->assertSame([], $this->submit());
    $this->assertSame([], $this->submit());

    $errors = $this->submit();
    $this->assertArrayHasKey('', $errors);
    $this->assertStringContainsString('several messages in a short time', $errors['']);
    $this->assertCount(2, $this->leads());
  }

}
