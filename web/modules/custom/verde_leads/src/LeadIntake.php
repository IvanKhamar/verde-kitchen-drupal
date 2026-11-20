<?php

declare(strict_types=1);

namespace Drupal\verde_leads;

use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Site\Settings;
use Drupal\verde_leads\Entity\Lead;

/**
 * Saves a valid contact message. Forwarding happens later, from a queue.
 *
 * A service (registered in verde_leads.services.yml) instead of code in the
 * form: the form only collects and validates input, and tests can call this
 * class directly. Drupal's container builds it and passes the dependencies in
 * (dependency injection), like ASP.NET Core or FastAPI's Depends().
 */
final class LeadIntake {

  public function __construct(
    private readonly EntityTypeManagerInterface $entityTypeManager,
    private readonly Settings $settings,
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
    return $lead;
  }

}
