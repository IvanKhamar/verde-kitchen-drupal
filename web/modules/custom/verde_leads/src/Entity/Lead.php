<?php

declare(strict_types=1);

namespace Drupal\verde_leads\Entity;

use Drupal\Core\Entity\Attribute\ContentEntityType;
use Drupal\Core\Entity\ContentEntityBase;
use Drupal\Core\Entity\EntityTypeInterface;
use Drupal\Core\Field\BaseFieldDefinition;
use Drupal\Core\StringTranslation\TranslatableMarkup;
use Drupal\verde_leads\LeadStatus;

/**
 * A message sent through the contact form.
 *
 * Every valid message is saved here first and forwarded to LeadTriage later
 * from a queue, so nothing is lost while LeadTriage is down. The schema lives
 * in code (base fields), so no field configuration is exported.
 */
#[ContentEntityType(
  id: 'verde_lead',
  label: new TranslatableMarkup('Contact message'),
  label_collection: new TranslatableMarkup('Contact messages'),
  label_singular: new TranslatableMarkup('contact message'),
  label_plural: new TranslatableMarkup('contact messages'),
  entity_keys: [
    'id' => 'id',
    'uuid' => 'uuid',
  ],
  admin_permission: 'view contact messages',
  base_table: 'verde_lead',
  label_count: [
    'singular' => '@count contact message',
    'plural' => '@count contact messages',
  ],
)]
class Lead extends ContentEntityBase {

  /**
   * Limits from the lead intake contract v1 (docs/phase-10-contact-form.md).
   */
  public const NAME_MIN = 2;
  public const NAME_MAX = 100;
  public const MESSAGE_MIN = 10;
  public const MESSAGE_MAX = 2000;
  public const PHONE_MAX = 32;

  /**
   * {@inheritdoc}
   */
  public function label(): string {
    // No personal data in labels: they can end up in logs and page titles.
    return (string) new TranslatableMarkup('Contact message @id', ['@id' => $this->id() ?? '']);
  }

  /**
   * The current status.
   */
  public function getStatus(): LeadStatus {
    return LeadStatus::from($this->get('status')->value);
  }

  /**
   * Sets the status.
   */
  public function setStatus(LeadStatus $status): static {
    $this->set('status', $status->value);
    return $this;
  }

  /**
   * The id LeadTriage uses to recognise a message sent twice.
   */
  public function externalId(): string {
    return 'verde-kitchen:contact:' . $this->id();
  }

  /**
   * {@inheritdoc}
   */
  public static function baseFieldDefinitions(EntityTypeInterface $entity_type): array {
    $fields = parent::baseFieldDefinitions($entity_type);

    $fields['name'] = BaseFieldDefinition::create('string')
      ->setLabel(new TranslatableMarkup('Name'))
      ->setRequired(TRUE)
      ->setSetting('max_length', self::NAME_MAX);

    $fields['email'] = BaseFieldDefinition::create('email')
      ->setLabel(new TranslatableMarkup('Email'))
      ->setRequired(TRUE);

    $fields['phone'] = BaseFieldDefinition::create('string')
      ->setLabel(new TranslatableMarkup('Phone'))
      ->setSetting('max_length', self::PHONE_MAX);

    $fields['message'] = BaseFieldDefinition::create('string_long')
      ->setLabel(new TranslatableMarkup('Message'))
      ->setRequired(TRUE);

    $fields['consent'] = BaseFieldDefinition::create('boolean')
      ->setLabel(new TranslatableMarkup('Consent to processing'))
      ->setDefaultValue(FALSE);

    $fields['locale'] = BaseFieldDefinition::create('string')
      ->setLabel(new TranslatableMarkup('Language'))
      ->setSetting('max_length', 12);

    $fields['page_url'] = BaseFieldDefinition::create('string')
      ->setLabel(new TranslatableMarkup('Page URL'))
      ->setSetting('max_length', 2048);

    $fields['created'] = BaseFieldDefinition::create('created')
      ->setLabel(new TranslatableMarkup('Received'));

    $fields['status'] = BaseFieldDefinition::create('list_string')
      ->setLabel(new TranslatableMarkup('Status'))
      ->setRequired(TRUE)
      ->setSetting('allowed_values', LeadStatus::options())
      ->setDefaultValue(LeadStatus::Pending->value);

    $fields['attempts'] = BaseFieldDefinition::create('integer')
      ->setLabel(new TranslatableMarkup('Attempts'))
      ->setSetting('unsigned', TRUE)
      ->setDefaultValue(0);

    $fields['next_attempt'] = BaseFieldDefinition::create('timestamp')
      ->setLabel(new TranslatableMarkup('Next attempt'));

    // An HTTP status code or an error type, never the message text.
    $fields['last_error'] = BaseFieldDefinition::create('string')
      ->setLabel(new TranslatableMarkup('Last error'))
      ->setSetting('max_length', 64);

    $fields['sent'] = BaseFieldDefinition::create('timestamp')
      ->setLabel(new TranslatableMarkup('Forwarded'));

    return $fields;
  }

}
