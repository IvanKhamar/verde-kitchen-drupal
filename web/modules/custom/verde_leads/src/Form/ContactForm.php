<?php

declare(strict_types=1);

namespace Drupal\verde_leads\Form;

use Drupal\Core\Flood\FloodInterface;
use Drupal\Core\Form\FormBase;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\Language\LanguageManagerInterface;
use Drupal\Core\StringTranslation\TranslatableMarkup;
use Drupal\Core\Url;
use Drupal\path_alias\AliasManagerInterface;
use Drupal\verde_leads\Entity\Lead;
use Drupal\verde_leads\LeadIntake;

/**
 * The contact form at /contact.
 *
 * Form API builds the form from an array, renders it, and on submit calls
 * validateForm() and then submitForm(). The constructor arguments are injected
 * by type (FormBase uses AutowireTrait).
 */
final class ContactForm extends FormBase {

  /**
   * The flood event name: one per accepted submission.
   */
  public const FLOOD_EVENT = 'verde_leads.contact';

  public function __construct(
    private readonly LeadIntake $intake,
    private readonly FloodInterface $flood,
    private readonly LanguageManagerInterface $languageManager,
    private readonly AliasManagerInterface $aliasManager,
  ) {}

  /**
   * {@inheritdoc}
   */
  public function getFormId(): string {
    return 'verde_leads_contact';
  }

  /**
   * {@inheritdoc}
   */
  public function buildForm(array $form, FormStateInterface $form_state): array {
    $form['#attributes']['class'][] = 'contact-form';
    // Server-side validation only, so every error is shown the same accessible
    // way (inline and in the summary), not as a browser bubble.
    $form['#attributes']['novalidate'] = 'novalidate';

    $form['intro'] = [
      '#type' => 'html_tag',
      '#tag' => 'p',
      '#value' => $this->t('Questions about our products, wholesale orders or a recipe? Write to us and we will answer within two working days. All fields are required unless marked optional.'),
      '#attributes' => ['class' => ['contact-form__intro']],
    ];

    $form['name'] = [
      '#type' => 'textfield',
      '#title' => $this->t('Name', [], ['context' => 'Contact form']),
      '#required' => TRUE,
      '#maxlength' => Lead::NAME_MAX,
      '#attributes' => ['autocomplete' => 'name'],
    ];
    $form['email'] = [
      '#type' => 'email',
      '#title' => $this->t('Email', [], ['context' => 'Contact form']),
      '#required' => TRUE,
      '#attributes' => ['autocomplete' => 'email'],
    ];
    $form['phone'] = [
      '#type' => 'tel',
      '#title' => $this->t('Phone (optional)'),
      '#maxlength' => Lead::PHONE_MAX,
      '#attributes' => ['autocomplete' => 'tel'],
    ];
    $form['message'] = [
      '#type' => 'textarea',
      '#title' => $this->t('Message', [], ['context' => 'Contact form']),
      '#required' => TRUE,
      '#rows' => 6,
      '#maxlength' => Lead::MESSAGE_MAX,
      '#description' => $this->t('From @min to @max characters.', [
        '@min' => Lead::MESSAGE_MIN,
        '@max' => Lead::MESSAGE_MAX,
      ]),
    ];
    $form['consent'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('I agree that Verde Kitchen processes my data to answer my message.'),
      '#description' => $this->privacyDescription(),
    ];

    // Honeypot: hidden from people by CSS and from the keyboard and screen
    // readers, but bots that fill in every field fill this one too.
    $form['website'] = [
      '#type' => 'textfield',
      '#title' => $this->t('Leave this field empty'),
      '#wrapper_attributes' => ['class' => ['contact-form__trap'], 'aria-hidden' => 'true'],
      '#attributes' => ['autocomplete' => 'off', 'tabindex' => '-1'],
    ];

    $form['actions'] = ['#type' => 'actions'];
    $form['actions']['submit'] = [
      '#type' => 'submit',
      '#value' => $this->t('Send message'),
    ];
    return $form;
  }

  /**
   * {@inheritdoc}
   */
  public function validateForm(array &$form, FormStateInterface $form_state): void {
    $config = $this->config('verde_leads.settings');
    if (!$this->flood->isAllowed(self::FLOOD_EVENT, (int) $config->get('flood.limit'), (int) $config->get('flood.window'))) {
      // A form-level error: shown at the top of the form.
      $form_state->setErrorByName('', $this->t('You have sent several messages in a short time. Please try again in an hour.'));
      return;
    }

    $name = trim((string) $form_state->getValue('name'));
    if ($name !== '' && mb_strlen($name) < Lead::NAME_MIN) {
      $form_state->setErrorByName('name', $this->t('Enter at least @count characters for your name.', ['@count' => Lead::NAME_MIN]));
    }

    $phone = trim((string) $form_state->getValue('phone'));
    if ($phone !== '' && !preg_match('/^\+?[0-9 ()-]{6,20}$/', $phone)) {
      $form_state->setErrorByName('phone', $this->t('Enter a phone number with digits only, for example +380 50 123 45 67.'));
    }

    $message = trim((string) $form_state->getValue('message'));
    $length = mb_strlen($message);
    if ($message !== '' && ($length < Lead::MESSAGE_MIN || $length > Lead::MESSAGE_MAX)) {
      $form_state->setErrorByName('message', $this->t('Your message must be from @min to @max characters long.', [
        '@min' => Lead::MESSAGE_MIN,
        '@max' => Lead::MESSAGE_MAX,
      ]));
    }

    if (!$form_state->getValue('consent')) {
      $form_state->setErrorByName('consent', $this->t('Please agree to the processing of your data, so we can answer you.'));
    }
  }

  /**
   * {@inheritdoc}
   */
  public function submitForm(array &$form, FormStateInterface $form_state): void {
    $config = $this->config('verde_leads.settings');
    $this->flood->register(self::FLOOD_EVENT, (int) $config->get('flood.window'));

    // A filled honeypot means a bot: it sees the usual answer, but nothing
    // is saved.
    if (trim((string) $form_state->getValue('website')) === '') {
      $this->intake->receive([
        'name' => trim((string) $form_state->getValue('name')),
        'email' => trim((string) $form_state->getValue('email')),
        'phone' => trim((string) $form_state->getValue('phone')),
        'message' => trim((string) $form_state->getValue('message')),
        'locale' => $this->languageManager->getCurrentLanguage()->getId(),
        'page_url' => Url::fromRoute('verde_leads.contact')->setAbsolute()->toString(),
      ]);
    }

    $this->messenger()->addStatus($this->t('Thank you! We have your message and will answer within two working days.'));
    // Post/Redirect/Get: reloading the page does not send the form again.
    $form_state->setRedirect('verde_leads.contact');
  }

  /**
   * The hint under the consent checkbox, linked to the Privacy page.
   *
   * Empty if the Privacy page does not exist.
   */
  private function privacyDescription(): TranslatableMarkup|string {
    $alias = (string) $this->config('verde_leads.settings')->get('privacy_path');
    $path = $alias !== '' ? $this->aliasManager->getPathByAlias($alias, 'en') : '';
    if ($path === '' || $path === $alias) {
      return '';
    }
    // The internal path (/node/ID) gets each language's own alias.
    return $this->t('How we handle it: <a href=":url">privacy notice</a>.', [
      ':url' => Url::fromUserInput($path)->toString(),
    ]);
  }

}
