<?php

declare(strict_types=1);

namespace Drupal\verde_leads\Hook;

use Drupal\Component\Datetime\TimeInterface;
use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Hook\Attribute\Hook;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Hook implementations of verde_leads (OOP hooks, Drupal 11.1+).
 */
final class LeadsHooks {

  /**
   * At most this many messages are deleted in one cron run.
   */
  private const DELETE_BATCH = 200;

  public function __construct(
    private readonly EntityTypeManagerInterface $entityTypeManager,
    private readonly ConfigFactoryInterface $configFactory,
    private readonly TimeInterface $time,
    #[Autowire(service: 'logger.channel.verde_leads')]
    private readonly LoggerInterface $logger,
  ) {}

  /**
   * Implements hook_cron().
   *
   * Deletes messages older than the retention period: personal data is not
   * kept longer than needed to answer (see the Privacy page).
   */
  #[Hook('cron')]
  public function deleteOldMessages(): void {
    $days = (int) $this->configFactory->get('verde_leads.settings')->get('retention_days');
    $storage = $this->entityTypeManager->getStorage('verde_lead');
    $ids = $storage->getQuery()
      ->accessCheck(FALSE)
      ->condition('created', $this->time->getRequestTime() - $days * 86400, '<')
      ->range(0, self::DELETE_BATCH)
      ->execute();
    if ($ids) {
      $storage->delete($storage->loadMultiple($ids));
      $this->logger->info('Deleted @count contact messages older than @days days.', [
        '@count' => count($ids),
        '@days' => $days,
      ]);
    }
  }

}
