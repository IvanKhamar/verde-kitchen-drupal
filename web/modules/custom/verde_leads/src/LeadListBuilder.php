<?php

declare(strict_types=1);

namespace Drupal\verde_leads;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Datetime\DateFormatterInterface;
use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Entity\EntityListBuilder;
use Drupal\Core\Entity\EntityStorageInterface;
use Drupal\Core\Entity\EntityTypeInterface;
use Drupal\Core\Entity\Query\QueryInterface;
use Drupal\Core\Site\Settings;
use Drupal\Core\State\StateInterface;
use Drupal\Core\Url;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * The admin list of contact messages at /admin/content/contact-messages.
 *
 * Every value is printed as plain text, so a name such as
 * "<script>alert(1)</script>" shows as text (tested in LeadAdminTest).
 */
final class LeadListBuilder extends EntityListBuilder {

  /**
   * {@inheritdoc}
   */
  protected $limit = 50;

  public function __construct(
    EntityTypeInterface $entity_type,
    EntityStorageInterface $storage,
    private readonly DateFormatterInterface $dateFormatter,
    private readonly Settings $settings,
    private readonly StateInterface $state,
    private readonly ConfigFactoryInterface $configFactory,
  ) {
    parent::__construct($entity_type, $storage);
  }

  /**
   * {@inheritdoc}
   */
  public static function createInstance(ContainerInterface $container, EntityTypeInterface $entity_type): static {
    return new static(
      $entity_type,
      $container->get('entity_type.manager')->getStorage($entity_type->id()),
      $container->get('date.formatter'),
      $container->get('settings'),
      $container->get('state'),
      $container->get('config.factory'),
    );
  }

  /**
   * {@inheritdoc}
   */
  protected function getEntityListQuery(): QueryInterface {
    // Newest first. The parent query sorts by ID ascending, so build our own.
    $query = $this->getStorage()->getQuery()
      ->accessCheck(TRUE)
      ->sort('created', 'DESC')
      ->sort('id', 'DESC');
    if ($this->limit) {
      $query->pager($this->limit);
    }
    return $query;
  }

  /**
   * {@inheritdoc}
   */
  public function buildHeader(): array {
    return [
      'id' => $this->t('ID'),
      'created' => $this->t('Received'),
      'name' => $this->t('Name', [], ['context' => 'Contact form']),
      'email' => $this->t('Email', [], ['context' => 'Contact form']),
      'status' => $this->t('Status'),
      'attempts' => $this->t('Attempts'),
      'last_error' => $this->t('Last error'),
    ] + parent::buildHeader();
  }

  /**
   * {@inheritdoc}
   */
  public function buildRow(EntityInterface $entity): array {
    /** @var \Drupal\verde_leads\Entity\Lead $entity */
    $text = fn (?string $value): array => ['data' => ['#plain_text' => (string) $value]];
    return [
      'id' => $entity->id(),
      'created' => $this->dateFormatter->format((int) $entity->get('created')->value, 'short'),
      'name' => $text($entity->get('name')->value),
      'email' => $text($entity->get('email')->value),
      'status' => $entity->getStatus()->label(),
      'attempts' => $entity->get('attempts')->value,
      'last_error' => $text($entity->get('last_error')->value),
    ] + parent::buildRow($entity);
  }

  /**
   * {@inheritdoc}
   */
  protected function getDefaultOperations(EntityInterface $entity): array {
    /** @var \Drupal\verde_leads\Entity\Lead $entity */
    $operations = [];
    if ($entity->access('view')) {
      $operations['view'] = [
        'title' => $this->t('View'),
        'weight' => 0,
        'url' => $entity->toUrl(),
      ];
    }
    $retry = Url::fromRoute('verde_leads.retry', ['verde_lead' => $entity->id()]);
    if ($entity->getStatus() === LeadStatus::Failed && $retry->access()) {
      $operations['retry'] = [
        'title' => $this->t('Retry'),
        'weight' => 10,
        'url' => $retry,
      ];
    }
    return $operations;
  }

  /**
   * {@inheritdoc}
   */
  public function render(): array {
    $build = parent::render();
    $build['table']['#empty'] = $this->t('No contact messages yet.');

    $notes = [];
    if ((string) $this->settings->get('verde_leads_url', '') === '') {
      $notes[] = $this->t('Forwarding to LeadTriage is off on this site: VERDE_LEADS_URL is not set. Messages are only kept here.');
    }
    $auth_failed = $this->state->get(LeadForwarder::AUTH_FAILED_STATE);
    if ($auth_failed) {
      $notes[] = $this->t('LeadTriage refused the source token on @date. Check VERDE_LEADS_TOKEN; waiting messages are sent again every hour.', [
        '@date' => $this->dateFormatter->format((int) $auth_failed, 'short'),
      ]);
    }
    $notes[] = $this->t('Messages are deleted @days days after they arrive.', [
      '@days' => $this->configFactory->get('verde_leads.settings')->get('retention_days'),
    ]);
    $build['notes'] = [
      '#theme' => 'item_list',
      '#items' => $notes,
      '#weight' => -10,
    ];
    // The list depends on these, not only on the messages themselves.
    $build['#cache']['tags'][] = 'config:verde_leads.settings';
    $build['#cache']['max-age'] = 0;
    return $build;
  }

}
