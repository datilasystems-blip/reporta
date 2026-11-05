<?php
/**
 * Footer template.
 *
 * @package REPORTA
 */
?>
</main>
<footer class="site-footer">
  <div class="container">
    <h3><?php esc_html_e( 'EMERGENCY CONTACTS', 'reporta' ); ?></h3>
    <ul>
      <li><?php esc_html_e( 'Police: 191', 'reporta' ); ?></li>
      <li><?php esc_html_e( 'Ambulance: 112', 'reporta' ); ?></li>
      <li><?php esc_html_e( 'DOVVSU: 0800-111-222', 'reporta' ); ?></li>
    </ul>
    <p><?php esc_html_e( 'REPORTA is not monitored continuously. In an emergency, always call 191 or 112.', 'reporta' ); ?></p>
  </div>
  <div class="footer-note">
    <?php esc_html_e( 'REPORTA by Datila for Ghana', 'reporta' ); ?>
  </div>
</footer>
<?php wp_footer(); ?>
</body>
</html>
