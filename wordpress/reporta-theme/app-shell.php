<?php
/**
 * REPORTA — exact app shell. Mirrors the compiled app's index.html.
 *
 * @package REPORTA
 */
?>
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#5b2d8e" />
    <title><?php echo esc_html( get_bloginfo( 'name' ) ); ?> — Speak up. Report safely. Get support.</title>
    <?php wp_head(); ?>
  </head>
  <body>
    <div id="root"></div>
    <?php wp_footer(); ?>
  </body>
</html>
