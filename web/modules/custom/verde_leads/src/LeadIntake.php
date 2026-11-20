<?php

declare(strict_types=1);

namespace Drupal\verde_leads;

use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Queue\QueueFactory;
use Drupal\Core\Site\Settings;
use Drupal\verde_leads\Entity\Lead;

/**
 * Saves a valid contact message and puts it in the forwarding queue.
 *
 * A service (registered in verde_leads.services.yml) instead of code in the
 * form: the form only collects and validates input, and tests can call this
 * class directly. Drupal's container builds it and passes the dependencies in
 * (dependency injection), like ASP.NET Core or FastAPI's Depends().
 *
 * Save first, send later: the visitor never waits for LeadTriage, and a
 * message is not lost while LeadTriage is down.
 */
final class LeadIntake {

  /**
   * The queue that ForwardLead works through.
   */
  public const QUEUE = 'verde_leads_forward';

  public function __construct(
    private readonly EntityTypeManagerInterface $entityTypeManager,
    private readonly Settings $settings,
    private readonly QueueFactory $queueFactory,
  ) {}

  /**
   * Whether this environment forwards messages to LeadTriage.
   */
  public function forwardingEnabled(): bool {
    return $this->settings->get('verde_leads_url', '') !== '';
  }

  /**
   * Saves a message that passed validation.
   *
   * @param array{name: string, email: string, phone: string, message: string, locale: string, page_url: string} $values
   *   The cleaned form values.
   */
  public function receive(array $values): Lead {
    /** @var \Drupal\verde_leads\Entity\Lead $lead */
    $lead = $this->entityTypeManager->getStorage('verde_lead')->create($values + ['consent' => TRUE]);
    $lead->setStatus($this->forwardingEnabled() ? LeadStatus::Pending : LeadStatus::NotForwarded);
    $lead->save();
    if ($lead->getStatus() === LeadStatus::Pending) {
      $this->enqueue($lead);
    }
    return $lead;
  }

  /**
   * Starts forwarding again from the first attempt (the admin "Retry").
   */
  public function retry(Lead $lead): void {
    $lead->setStatus($this->forwardingEnabled() ? LeadStatus::Pending : LeadStatus::NotForwarded)
      ->set('attempts', 0)
      ->set('next_attempt', NULL)
      ->set('last_error', NULL)
      ->save();
    if ($lead->getStatus() === LeadStatus::Pending) {
      $this->enqueue($lead);
    }
  }

  /**
   * Adds the message to the queue. The item holds only its id.
   */
  private function enqueue(Lead $lead): void {
    $this->queueFactory->get(self::QUEUE)->createItem(['id' => (int) $lead->id()]);
  }

}
