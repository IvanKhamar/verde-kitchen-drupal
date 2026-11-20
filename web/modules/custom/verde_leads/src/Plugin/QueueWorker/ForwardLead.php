<?php

declare(strict_types=1);

namespace Drupal\verde_leads\Plugin\QueueWorker;

use Drupal\Component\Datetime\TimeInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Plugin\ContainerFactoryPluginInterface;
use Drupal\Core\Queue\Attribute\QueueWorker;
use Drupal\Core\Queue\DelayedRequeueException;
use Drupal\Core\Queue\QueueWorkerBase;
use Drupal\Core\StringTranslation\TranslatableMarkup;
use Drupal\verde_leads\LeadForwarder;
use Drupal\verde_leads\LeadStatus;

/**
 * Forwards saved contact messages to LeadTriage.
 *
 * Runs on cron (up to 30 seconds each time) and with
 * "drush queue:run verde_leads_forward". An item holds only the message id;
 * the data stays in the verde_lead entity. A DelayedRequeueException puts the
 * item back with a pause instead of trying again at once.
 */
#[QueueWorker(
  id: 'verde_leads_forward',
  title: new TranslatableMarkup('Forward contact messages to LeadTriage'),
  cron: ['time' => 30],
)]
final class ForwardLead extends QueueWorkerBase implements ContainerFactoryPluginInterface {

  public function __construct(
    array $configuration,
    string $plugin_id,
    mixed $plugin_definition,
    private readonly EntityTypeManagerInterface $entityTypeManager,
    private readonly LeadForwarder $forwarder,
    private readonly TimeInterface $time,
  ) {
    parent::__construct($configuration, $plugin_id, $plugin_definition);
  }

  /**
   * {@inheritdoc}
   */
  public function processItem($data): void {
    /** @var \Drupal\verde_leads\Entity\Lead|null $lead */
    $lead = $this->entityTypeManager->getStorage('verde_lead')->load($data['id'] ?? 0);
    // Deleted (retention) or already handled: nothing to do.
    if (!$lead || $lead->getStatus() !== LeadStatus::Pending) {
      return;
    }

    $wait = (int) $lead->get('next_attempt')->value - $this->time->getRequestTime();
    if ($wait > 0) {
      throw new DelayedRequeueException($wait);
    }

    $delay = $this->forwarder->forward($lead);
    if ($delay !== NULL) {
      throw new DelayedRequeueException($delay);
    }
  }

}
