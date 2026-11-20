<?php

declare(strict_types=1);

namespace Drupal\verde_leads\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\verde_leads\Form\ContactForm;

/**
 * The /contact page: the form, or a notice on the static copy.
 */
final class ContactController extends ControllerBase {

  /**
   * Builds the page.
   */
  public function page(): array {
    // The static copy (GitHub Pages) has no Drupal behind it to receive the
    // form; see scripts/static/build.mjs.
    if (getenv('VERDE_STATIC_EXPORT') === '1') {
      return [
        '#type' => 'html_tag',
        '#tag' => 'p',
        '#value' => $this->t('This is a static copy of the site, so the contact form does not work here. It works on the full Drupal site; see the <a href=":url">source code</a> for how it is built.', [
          ':url' => 'https://github.com/IvanKhamar/verde-kitchen-drupal',
        ]),
        '#attributes' => ['class' => ['contact-static-notice']],
      ];
    }
    return $this->formBuilder()->getForm(ContactForm::class);
  }

}
