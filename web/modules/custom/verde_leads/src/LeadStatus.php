<?php

declare(strict_types=1);

namespace Drupal\verde_leads;

/**
 * Where a contact message is on its way to LeadTriage.
 */
enum LeadStatus: string {

  // Saved and waiting in the queue.
  case Pending = 'pending';

  // LeadTriage accepted it (202).
  case Sent = 'sent';

  // LeadTriage already had it (200 duplicate): a retry after a lost answer.
  case Duplicate = 'duplicate';

  // Rejected (400) or out of attempts. An admin can retry it.
  case Failed = 'failed';

  // Forwarding is off: no LeadTriage URL in this environment.
  case NotForwarded = 'not_forwarded';

  /**
   * A short label for admin pages.
   */
  public function label(): string {
    return match ($this) {
      self::Pending => 'Pending',
      self::Sent => 'Sent',
      self::Duplicate => 'Duplicate',
      self::Failed => 'Failed',
      self::NotForwarded => 'Not forwarded',
    };
  }

  /**
   * Options for the status field: value => label.
   *
   * @return array<string, string>
   *   The allowed values.
   */
  public static function options(): array {
    $options = [];
    foreach (self::cases() as $case) {
      $options[$case->value] = $case->label();
    }
    return $options;
  }

}
