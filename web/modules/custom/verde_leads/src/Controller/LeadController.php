<?php

declare(strict_types=1);

namespace Drupal\verde_leads\Controller;

use Drupal\Component\Utility\Html;
use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Datetime\DateFormatterInterface;
use Drupal\Core\StringTranslation\TranslatableMarkup;
use Drupal\verde_leads\Entity\Lead;
use Drupal\verde_leads\LeadIntake;
use Symfony\Component\HttpFoundation\RedirectResponse;

/**
 * Admin pages for one contact message: view it, send it again.
 */
final class LeadController extends ControllerBase {

  public function __construct(
    private readonly LeadIntake $intake,
    private readonly DateFormatterInterface $dateFormatter,
  ) {}

  /**
   * Title of the message page.
   */
  public function title(Lead $verde_lead): string {
    return $verde_lead->label();
  }

  /**
   * Shows every field of the message as plain text.
   */
  public function view(Lead $verde_lead): array {
    $date = fn (?string $time): string => $time ? $this->dateFormatter->format((int) $time, 'medium') : '';
    $rows = [];
    $values = [
      'name' => $verde_lead->get('name')->value,
      'email' => $verde_lead->get('email')->value,
      'phone' => $verde_lead->get('phone')->value,
      'locale' => $verde_lead->get('locale')->value,
      'page_url' => $verde_lead->get('page_url')->value,
      'created' => $date($verde_lead->get('created')->value),
      'status' => $verde_lead->getStatus()->label(),
      'attempts' => $verde_lead->get('attempts')->value,
      'next_attempt' => $date($verde_lead->get('next_attempt')->value),
      'last_error' => $verde_lead->get('last_error')->value,
      'sent' => $date($verde_lead->get('sent')->value),
    ];
    foreach ($values as $field => $value) {
      $rows[] = [
        ['data' => $verde_lead->getFieldDefinition($field)->getLabel(), 'header' => TRUE],
        ['data' => ['#plain_text' => (string) $value]],
      ];
    }
    return [
      'fields' => [
        '#type' => 'table',
        '#rows' => $rows,
      ],
      'message' => [
        '#type' => 'details',
        '#title' => new TranslatableMarkup('Message', [], ['context' => 'Contact form']),
        '#open' => TRUE,
        // Escaped first, then line breaks kept.
        'text' => ['#markup' => nl2br(Html::escape((string) $verde_lead->get('message')->value))],
      ],
      '#cache' => ['tags' => $verde_lead->getCacheTags()],
    ];
  }

  /**
   * Sends a failed message again, from the first attempt.
   *
   * The route has a CSRF token, so another site cannot trigger it with a
   * hidden link.
   */
  public function retry(Lead $verde_lead): RedirectResponse {
    $this->intake->retry($verde_lead);
    $this->messenger()->addStatus($this->t('@label will be sent again within a few minutes.', ['@label' => $verde_lead->label()]));
    return $this->redirect('entity.verde_lead.collection');
  }

}
