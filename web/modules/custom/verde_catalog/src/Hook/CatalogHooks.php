<?php

declare(strict_types=1);

namespace Drupal\verde_catalog\Hook;

use Drupal\Core\Entity\EntityTypeInterface;
use Drupal\Core\Field\BaseFieldDefinition;
use Drupal\Core\Hook\Attribute\Hook;
use Drupal\Core\StringTranslation\StringTranslationTrait;
use Drupal\verde_catalog\Plugin\Field\CardImageUrlItemList;

/**
 * Hook implementations for the Verde catalog module.
 *
 * Since Drupal 11.1 hooks can be methods of a class with the #[Hook]
 * attribute, instead of functions in the .module file.
 */
final class CatalogHooks {

  use StringTranslationTrait;

  /**
   * Implements hook_entity_bundle_field_info().
   *
   * A computed field has no database table: its value is calculated when it
   * is read. JSON:API exposes it like any other field, as the attribute
   * "card_image_url" of node--product resources.
   */
  #[Hook('entity_bundle_field_info')]
  public function entityBundleFieldInfo(EntityTypeInterface $entity_type, string $bundle, array $base_field_definitions): array {
    if ($entity_type->id() !== 'node' || $bundle !== 'product') {
      return [];
    }

    return [
      'card_image_url' => BaseFieldDefinition::create('string')
        ->setName('card_image_url')
        ->setLabel($this->t('Card image URL'))
        ->setDescription($this->t('URL of the product image in the "card" image style.'))
        ->setTargetEntityTypeId('node')
        ->setTargetBundle('product')
        ->setComputed(TRUE)
        ->setReadOnly(TRUE)
        ->setClass(CardImageUrlItemList::class),
    ];
  }

  /**
   * Implements hook_theme().
   *
   * The shopping list page template. The module ships a plain default
   * (templates/verde-shopping-list.html.twig); the theme overrides it.
   */
  #[Hook('theme')]
  public function theme(): array {
    return [
      'verde_shopping_list' => [
        'variables' => ['api_base' => NULL, 'base_path' => NULL, 'static_data' => NULL],
      ],
    ];
  }

}
