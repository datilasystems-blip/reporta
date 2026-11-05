<?php
/**
 * REPORTA by Datila — app-shell theme.
 *
 * Serves the compiled REPORTA React application (the exact build that runs on
 * localhost, Android, and Windows) so WordPress shows the same interface.
 *
 * @package REPORTA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Compiled bundle filenames (update after every build of apps/web).
// Vite inlines CSS into the JS bundle, so only the JS asset ships.
define( 'REPORTA_JS', 'index-DODMXrme.js' );

/**
 * Backend URL injected into the page as window.REPORTA_API_URL, which the SPA
 * reads instead of falling back to localhost. Override in wp-config.php:
 *   define( 'REPORTA_API_URL', 'https://your-api-host' );
 */
function reporta_api_url() {
	$default = defined( 'REPORTA_API_URL' ) ? REPORTA_API_URL : 'https://api.reporta.example';
	return apply_filters( 'reporta_api_url', $default );
}

/**
 * Front-end: print the app's tags exactly as Vite's index.html does.
 */
function reporta_head_tags() {
	$base = get_theme_file_uri( 'assets' );
	?>
	<script>window.REPORTA_API_URL = <?php echo wp_json_encode( reporta_api_url() ); ?>;</script>
	<script type="module" crossorigin src="<?php echo esc_url( $base . '/' . REPORTA_JS ); ?>"></script>
	<?php
}
add_action( 'wp_head', 'reporta_head_tags', 1 );

/**
 * The SPA owns every front-end route — redirect front-end rendering to the
 * app shell while keeping WordPress endpoints (login, REST, feed) intact.
 */
function reporta_template_redirect() {
	if ( is_admin() || wp_doing_ajax() || wp_doing_cron() ) {
		return;
	}
	if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
		return;
	}
	if ( is_feed() || is_robots() || is_embed() ) {
		return;
	}
	include get_theme_file_path( 'app-shell.php' );
	exit;
}
add_action( 'template_redirect', 'reporta_template_redirect', 1 );

/**
 * Primary menu registration for the static fallback rendering.
 */
add_action( 'after_setup_theme', function () {
	register_nav_menus( array(
		'primary' => __( 'Primary Menu', 'reporta' ),
	) );
} );

function reporta_fallback_menu() {
	echo '<ul>';
	echo '<li><a href="' . esc_url( home_url( '/' ) ) . '">' . esc_html__( 'Home', 'reporta' ) . '</a></li>';
	echo '<li><a href="' . esc_url( home_url( '/report' ) ) . '">' . esc_html__( 'Report a Crime', 'reporta' ) . '</a></li>';
	echo '<li><a href="' . esc_url( home_url( '/track' ) ) . '">' . esc_html__( 'Track Report', 'reporta' ) . '</a></li>';
	echo '<li><a href="' . esc_url( home_url( '/support' ) ) . '">' . esc_html__( 'Get Support', 'reporta' ) . '</a></li>';
	echo '</ul>';
}
