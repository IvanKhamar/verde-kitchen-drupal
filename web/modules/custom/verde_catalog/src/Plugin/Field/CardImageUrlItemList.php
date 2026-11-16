<?php

declare(strict_types=1);

namespace Drupal\verde_catalog\Plugin\Field;

use Drupal\Core\Field\FieldItemList;
use Drupal\Core\TypedData\ComputedItemListTrait;
use Drupal\image\Entity\ImageStyle;

/**
 * Computes the URL of a product's image in the "card" image style.
 *
 * Why the back end does this: an image style URL contains a security token
 * ("itok") that only Drupal can calculate. Without it a client could make the
 * server generate unlimited image variants. The React catalog widget gets the
 * finished URL, the same one the Twig cards use, so the browser can reuse the
 * cached image.
 */
final class CardImageUrlItemList extends FieldItemList {

  use ComputedItemListTrait;

  /**
   * {@inheritdoc}
   */
  protected function computeValue(): void {
    $file = $this->getEntity()->get('field_image')->entity;
    $style = ImageStyle::load('card');
    if (!$file || !$style) {
      return;
    }

    // A root-relative URL ("/sites/default/files/styles/card/..."), exactly
    // as the server-rendered <img> tags print it.
    $url = \Drupal::service('file_url_generator')->transformRelative($style->buildUrl($file->getFileUri()));
    $this->list[0] = $this->createItem(0, $url);
  }

}
