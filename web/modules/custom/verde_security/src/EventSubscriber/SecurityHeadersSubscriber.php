<?php

declare(strict_types=1);

namespace Drupal\verde_security\EventSubscriber;

use Drupal\Core\Routing\AdminContext;
use Drupal\Core\Session\AccountInterface;
use Drupal\csp\Csp;
use Drupal\csp\CspEvents;
use Drupal\csp\Event\PolicyAlterEvent;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Adds security headers and adjusts the Content Security Policy.
 *
 * The CSP module sends the site-wide policy (csp.settings): scripts, styles,
 * fonts and connections only from this site, no inline code, no framing.
 * This subscriber adds the headers the CSP module does not cover.
 */
final class SecurityHeadersSubscriber implements EventSubscriberInterface {

  public function __construct(
    private readonly AdminContext $adminContext,
    private readonly AccountInterface $currentUser,
  ) {}

  /**
   * {@inheritdoc}
   */
  public static function getSubscribedEvents(): array {
    return [
      CspEvents::POLICY_ALTER => 'alterPolicy',
      // After Drupal core's own headers (FinishResponseSubscriber, priority 0).
      KernelEvents::RESPONSE => ['addHeaders', -10],
    ];
  }

  /**
   * Allows inline styles for administrators only.
   *
   * Claro and the toolbar set style="…" attributes, which a strict style-src
   * blocks. Visitors never see those pages, so the public site keeps the
   * strict policy. Inline scripts stay blocked for everyone.
   */
  public function alterPolicy(PolicyAlterEvent $event): void {
    $needs_inline_styles = $this->adminContext->isAdminRoute()
      || $this->currentUser->hasPermission('access toolbar');
    if ($needs_inline_styles) {
      $event->getPolicy()->fallbackAwareAppendIfEnabled('style-src', [Csp::POLICY_UNSAFE_INLINE]);
    }
  }

  /**
   * Adds headers that limit what a page may do in the browser.
   */
  public function addHeaders(ResponseEvent $event): void {
    if (!$event->isMainRequest()) {
      return;
    }
    $headers = $event->getResponse()->headers;
    // Full URL only to this site; other sites see just the origin.
    $headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
    // The site needs no camera, microphone, location or payment APIs.
    $headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    // For old browsers without CSP frame-ancestors support.
    $headers->set('X-Frame-Options', 'DENY');
  }

}
