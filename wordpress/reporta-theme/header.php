<?php
/**
 * Header template (static fallback rendering; the SPA replaces it).
 *
 * @package REPORTA
 */
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo( 'charset' ); ?>" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<a class="skip-link screen-reader-text" href="#content"><?php esc_html_e( 'Skip to content', 'reporta' ); ?></a>
<header class="site-header">
  <div class="container">
    <a class="brand" href="<?php echo esc_url( home_url( '/' ) ); ?>">
      <span class="brand-text">
        <span class="site-title">REPORT<span class="accent">A</span></span>
        <span class="site-description"><?php esc_html_e( 'Speak up. Report safely. Get support.', 'reporta' ); ?></span>
      </span>
    </a>
    <nav class="main-navigation" aria-label="<?php esc_attr_e( 'Primary', 'reporta' ); ?>">
      <?php
      wp_nav_menu( array(
        'theme_location' => 'primary',
        'container'      => false,
        'fallback_cb'    => 'reporta_fallback_menu',
      ) );
      ?>
    </nav>
  </div>
</header>
<main id="content" class="site-main">
