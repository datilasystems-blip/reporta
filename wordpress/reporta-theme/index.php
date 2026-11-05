<?php
/**
 * Fallback index.php: renders a static REPORTA landing page with a working
 * link into the app shell. Only shown if the SPA bundle fails to mount.
 *
 * @package REPORTA
 */
get_header();
?>
<main class="site-main">
  <section class="hero">
    <h1>Speak up. <span class="accent">Report safely.</span> Get support.</h1>
    <p>REPORTA lets anyone in Ghana report a crime securely and routes it to authorised personnel for review.</p>
    <a class="btn btn-gold" href="<?php echo esc_url( home_url( '/report' ) ); ?>">Report a Crime</a>
    <a class="btn btn-ghost" href="<?php echo esc_url( home_url( '/track' ) ); ?>">Track My Report</a>
  </section>
  <div class="container" style="padding: 40px 20px;">
    <div class="card-grid">
      <div class="card"><h3>Report a crime</h3><p>Submit a report in minutes — with or without your identity.</p></div>
      <div class="card"><h3>Safe &amp; confidential</h3><p>Anonymous or confidential reporting with secure evidence storage.</p></div>
      <div class="card"><h3>Track your report</h3><p>Follow your case with your reference number and tracking code.</p></div>
    </div>
  </div>
</main>
<?php
get_footer();
