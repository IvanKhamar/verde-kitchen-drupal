<?php

declare(strict_types=1);

namespace Drupal\verde_catalog\Controller;

use Drupal\Core\DependencyInjection\ContainerInjectionInterface;
use Drupal\Core\Language\LanguageManagerInterface;
use Drupal\Core\Url;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * The shopping list page.
 *
 * The list is stored in the visitor's browser, not in Drupal, so the server
 * only renders a mount point: a React app (theme library
 * verde/shopping-list-page) loads the products from JSON:API.
 */
final class ShoppingListController implements ContainerInjectionInterface {

  public function __construct(
    private readonly LanguageManagerInterface $languageManager,
  ) {}

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container): self {
    return new self($container->get('language_manager'));
  }

  /**
   * Builds the page.
   */
  public function page(): array {
    $static_data = NULL;
    // In the static copy (GitHub Pages) there is no JSON:API; see the theme's
    // verde_preprocess_views_view() and scripts/static/build.mjs.
    if (getenv('VERDE_STATIC_EXPORT') === '1') {
      $static_data = base_path() . 'static-data/' . $this->languageManager->getCurrentLanguage()->getId();
    }

    return [
      '#theme' => 'verde_shopping_list',
      '#api_base' => Url::fromRoute('jsonapi.resource_list')->toString(),
      '#base_path' => Url::fromRoute('<front>')->toString(),
      '#static_data' => $static_data,
    ];
  }

}
