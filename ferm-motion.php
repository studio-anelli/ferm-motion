<?php
/**
 * Plugin Name: Organic Motion
 * Description: Lightweight, accessible scroll-triggered motion effects for WPBakery / Impreza and regular WordPress content.
 * Version: 1.0.23
 * Plugin URI: https://anelli.studio/
 * Requires PHP: 7.4
 * Author: Anelli Studio
 * License: GPL-2.0-or-later
 * Text Domain: ferm-motion
 * GitHub Plugin URI: https://github.com/studio-anelli/ferm-motion
 * Primary Branch: main
 */
if (!defined('ABSPATH')) { exit; }

final class FERM_Motion {
    const OPTION = 'ferm_motion_settings';
    const VERSION = '1.0.23';

    public static function defaults() {
        return array('duration'=>900, 'distance'=>36, 'stagger'=>120, 'parallax_percent'=>12, 'image_parallax_percent'=>7, 'organic_travel_percent'=>7, 'organic_intensity'=>100, 'organic_easing'=>'editorial', 'image_parallax_radius'=>0, 'background_parallax_percent'=>9, 'background_overscan'=>8, 'section_parallax_percent'=>4, 'parallax_easing'=>'soft', 'image_easing'=>'soft', 'background_easing'=>'soft', 'section_easing'=>'soft', 'scroll_enabled'=>0, 'scroll_smoothing'=>10, 'scroll_wheel'=>85, 'scroll_focus'=>'off', 'image_trigger'=>45, 'text_trigger'=>95, 'once'=>1, 'enabled'=>1, 'color_enabled'=>1, 'color_position'=>55, 'color_softness'=>'balanced', 'color_start'=>80, 'color_end'=>20, 'color_easing'=> 'smooth', 'color_cream'=>'#F8F4EC', 'color_orange'=>'#F16A37', 'color_green'=>'#507568', 'color_pink'=>'#DD8EB9', 'color_ink'=>'#25231F', 'header_enabled'=>0, 'header_mode'=>'transparent', 'header_contrast'=>'auto', 'header_selector'=>'.l-header', 'header_mono_logo'=>0, 'header_easing'=>'follow');
    }
    public static function settings() {
        return wp_parse_args(get_option(self::OPTION, array()), self::defaults());
    }
    public static function init() {
        add_action('wp_enqueue_scripts', array(__CLASS__, 'assets'));
        add_action('admin_menu', array(__CLASS__, 'menu'));
        add_action('admin_init', array(__CLASS__, 'register'));
        FERM_Motion_Sliders::init();
    }
    public static function assets() {
        if (is_admin()) { return; }
        $settings = self::settings();
        if (empty($settings['enabled'])) { return; }
        wp_enqueue_style('ferm-motion', plugin_dir_url(__FILE__) . 'motion.css', array(), self::VERSION);
        if (!empty($settings['scroll_enabled'])) {
            wp_enqueue_script('ferm-lenis', 'https://cdn.jsdelivr.net/npm/lenis@1.3.27/dist/lenis.min.js', array(), '1.3.27', true);
        }
        wp_register_script('ferm-simplex-noise', plugin_dir_url(__FILE__) . 'simplex-noise.js', array(), '4.0.3', true);
        $dependencies = array('ferm-simplex-noise');
        if (!empty($settings['scroll_enabled'])) {
            $dependencies[] = 'ferm-lenis';
        }
        wp_enqueue_script('ferm-motion', plugin_dir_url(__FILE__) . 'motion.js', $dependencies, self::VERSION, true);
        $config = array(
            'duration' => (int) $settings['duration'],
            'distance' => (int) $settings['distance'],
            'stagger'  => (int) $settings['stagger'],
            'parallax' => (int) $settings['parallax_percent'],
            'imageParallax' => (int) $settings['image_parallax_percent'],
            'organicTravelPercent' => (float) $settings['organic_travel_percent'],
            'organicIntensity' => (int) $settings['organic_intensity'],
            'organicEasing' => $settings['organic_easing'],
            'imageParallaxRadius' => (int) $settings['image_parallax_radius'],
            'backgroundParallax' => (int) $settings['background_parallax_percent'],
            'backgroundOverscan' => (int) $settings['background_overscan'],
            'sectionParallax' => (int) $settings['section_parallax_percent'],
            'easing' => array('image'=>$settings['image_easing'],'background'=>$settings['background_easing'],'section'=>$settings['section_easing'],'legacy'=>$settings['parallax_easing']),
            'scrollEnabled' => !empty($settings['scroll_enabled']),
            'scrollSmoothing' => (int) $settings['scroll_smoothing'],
            'scrollWheel' => (int) $settings['scroll_wheel'],
            'scrollFocus' => $settings['scroll_focus'],
            'imageTrigger' => (int) $settings['image_trigger'],
            'textTrigger' => (int) $settings['text_trigger'],
            'once'     => !empty($settings['once']),
            'colorEnabled' => !empty($settings['color_enabled']),
            'colorPosition' => (int) $settings['color_position'],
            'colorSoftness' => $settings['color_softness'],
            'colorStart' => (int) $settings['color_start'],
            'colorEnd' => (int) $settings['color_end'],
            'colorEasing' => $settings['color_easing'],
            'colors' => array('cream'=>$settings['color_cream'],'orange'=>$settings['color_orange'],'green'=>$settings['color_green'],'pink'=>$settings['color_pink'],'ink'=>$settings['color_ink']),
            'headerEnabled' => !empty($settings['header_enabled']),
            'headerMode' => $settings['header_mode'],
            'headerContrast' => $settings['header_contrast'],
            'headerSelector' => $settings['header_selector'],
            'headerMonoLogo' => !empty($settings['header_mono_logo']),
            'headerEasing' => $settings['header_easing'],
        );
        wp_add_inline_script('ferm-motion', 'window.FERMMotionConfig = ' . wp_json_encode($config) . ';', 'before');
        if (!empty($settings['header_enabled'])) {
            wp_enqueue_style('ferm-adaptive-header', plugin_dir_url(__FILE__).'adaptive-header.css', array('ferm-motion'), self::VERSION);
            wp_enqueue_script('ferm-adaptive-header', plugin_dir_url(__FILE__).'adaptive-header.js', array('ferm-motion'), self::VERSION, true);
        }
    }
    public static function menu() {
        add_menu_page('Organic Motion', 'Organic Motion', 'manage_options', 'ferm-motion', array(__CLASS__, 'page'), 'dashicons-controls-play', 57);
        add_submenu_page('ferm-motion', 'Motion settings', 'Settings', 'manage_options', 'ferm-motion', array(__CLASS__, 'page'));
    }
    public static function register() {
        register_setting('ferm_motion', self::OPTION, array(
            'type'=>'array', 'sanitize_callback'=>array(__CLASS__, 'sanitize'), 'default'=>self::defaults(),
        ));
    }
    public static function sanitize($raw) {
        $raw = is_array($raw) ? $raw : array();
        return array(
            'enabled'=>empty($raw['enabled']) ? 0 : 1,
            'duration'=>max(250, min(2400, absint($raw['duration'] ?? 900))),
            'distance'=>max(0, min(120, absint($raw['distance'] ?? 36))),
            'stagger'=>max(0, min(600, absint($raw['stagger'] ?? 120))),
            'parallax_percent'=>max(0, min(30, absint($raw['parallax_percent'] ?? 12))),
            'image_parallax_percent'=>max(0, min(30, absint($raw['image_parallax_percent'] ?? 7))),
            'image_parallax_radius'=>max(0, min(200, (int) ($raw['image_parallax_radius'] ?? 0))),
            'background_parallax_percent'=>max(0, min(30, absint($raw['background_parallax_percent'] ?? 9))),
            'background_overscan'=>max(0, min(30, absint($raw['background_overscan'] ?? 8))),
            'section_parallax_percent'=>max(0, min(30, absint($raw['section_parallax_percent'] ?? 4))),
            'parallax_easing'=>self::ease_option($raw['parallax_easing'] ?? 'soft'),
            'organic_travel_percent'=>max(0, min(30, (float) ($raw['organic_travel_percent'] ?? 7))),
            'organic_intensity'=>max(0, min(200, (int) ($raw['organic_intensity'] ?? 100))),
            'organic_easing'=>in_array($raw['organic_easing'] ?? '',array('linear','editorial','bubble'),true) ? $raw['organic_easing'] : 'editorial',
            'image_easing'=>self::ease_option($raw['image_easing'] ?? 'soft'),
            'background_easing'=>self::ease_option($raw['background_easing'] ?? 'soft'),
            'section_easing'=>self::ease_option($raw['section_easing'] ?? 'soft'),
            'scroll_enabled'=>empty($raw['scroll_enabled']) ? 0 : 1,
            'scroll_smoothing'=>max(4,min(22,absint($raw['scroll_smoothing'] ?? 10))),
            'scroll_wheel'=>max(50,min(140,absint($raw['scroll_wheel'] ?? 85))),
            'scroll_focus'=>in_array($raw['scroll_focus'] ?? '',array('off','gentle','defined'),true) ? $raw['scroll_focus'] : 'off',
            'image_trigger'=>max(10, min(95, absint($raw['image_trigger'] ?? 45))),
            'text_trigger'=>max(10, min(95, absint($raw['text_trigger'] ?? 95))),
            'once'=>empty($raw['once']) ? 0 : 1,
            'color_enabled'=>empty($raw['color_enabled']) ? 0 : 1,
            'header_enabled'=>empty($raw['header_enabled']) ? 0 : 1,
            'header_mode'=>in_array($raw['header_mode']??'',array('transparent','match'),true)?$raw['header_mode']:'transparent',
            'header_contrast'=>in_array($raw['header_contrast']??'',array('auto','light','dark','theme'),true)?$raw['header_contrast']:'auto',
            'header_selector'=>self::header_selector($raw['header_selector']??'.l-header'),
            'header_mono_logo'=>empty($raw['header_mono_logo']) ? 0 : 1,
            'header_easing'=>in_array($raw['header_easing']??'',array('follow','quick','soft','cinematic'),true)?$raw['header_easing']:'follow',
            'color_position'=>max(15,min(85,absint($raw['color_position'] ?? 55))),
            'color_softness'=>in_array($raw['color_softness'] ?? '',array('tight','balanced','atmospheric'),true) ? $raw['color_softness'] : 'balanced',
            'color_start'=>max(30,min(95,absint($raw['color_start'] ?? 80))),
            'color_end'=>max(5,min(70,absint($raw['color_end'] ?? 20))),
            'color_easing'=>in_array($raw['color_easing'] ?? '',array('linear','smooth'),true) ? $raw['color_easing'] : 'smooth',
            'color_names'=>array_map('sanitize_text_field', array_intersect_key((array) ($raw['color_names'] ?? array()), array_flip(array('cream','orange','green','pink','ink')))),
            'color_cream'=>sanitize_hex_color($raw['color_cream'] ?? '#F8F4EC') ?: '#F8F4EC',
            'color_orange'=>sanitize_hex_color($raw['color_orange'] ?? '#F16A37') ?: '#F16A37',
            'color_green'=>sanitize_hex_color($raw['color_green'] ?? '#507568') ?: '#507568',
            'color_pink'=>sanitize_hex_color($raw['color_pink'] ?? '#DD8EB9') ?: '#DD8EB9',
            'color_ink'=>sanitize_hex_color($raw['color_ink'] ?? '#25231F') ?: '#25231F',
        );
    }
    public static function header_selector($value) {
        $value=is_string($value)?trim($value):'.l-header';
        // A simple, bounded CSS selector avoids accidentally storing arbitrary CSS.
        return preg_match('/^[a-zA-Z0-9.#_ -]{1,100}$/',$value)?$value:'.l-header';
    }
    public static function ease_option($value) { return in_array($value,array('direct','soft','cinematic'),true) ? $value : 'soft'; }
    public static function ease_field($name,$label) {
        $s=self::settings();
        printf('<tr><th scope="row">%s</th><td><select name="%s[%s]">',esc_html($label),esc_attr(self::OPTION),esc_attr($name));
        foreach(array('direct'=>'Direct / responsive','soft'=>'Soft / editorial','cinematic'=>'Cinematic / slow catch-up') as $key=>$value)printf('<option value="%s" %s>%s</option>',esc_attr($key),selected($s[$name],$key,false),esc_html($value));
        echo '</select></td></tr>';
    }
    public static function field($name, $label, $min, $max, $unit='') {
        $s=self::settings();
        printf('<tr><th scope="row"><label for="dm-%1$s">%2$s</label></th><td><input id="dm-%1$s" type="number" name="%3$s[%1$s]" value="%4$d" min="%5$d" max="%6$d" step="1" class="small-text"> %7$s</td></tr>',
            esc_attr($name),esc_html($label),esc_attr(self::OPTION),(int)$s[$name],(int)$min,(int)$max,esc_html($unit));
    }
    public static function field_input($name, $min, $max) {
        $s=self::settings();
        printf('<input type="number" name="%1$s[%2$s]" value="%3$d" min="%4$d" max="%5$d" class="small-text">',esc_attr(self::OPTION),esc_attr($name),(int)$s[$name],(int)$min,(int)$max);
    }
    public static function color_field($name,$title,$class) {
        $s=self::settings();
        $label = ($s['color_names'][$name] ?? '') ?: $title;
        printf('<div class="dm-color-field"><label><span>Swatch name</span><input type="text" name="%1$s[color_names][%2$s]" value="%3$s"></label><label><span>Colour</span><input type="color" name="%1$s[color_%2$s]" value="%4$s"></label><code>dm-color-%5$s</code></div>',
            esc_attr(self::OPTION), esc_attr($name), esc_attr($label), esc_attr($s['color_'.$name]), esc_html($class));
    }
    public static function page() {
        if (!current_user_can('manage_options')) { return; }
        $s=self::settings(); ?>
        <div class="wrap dm-settings"><h1>Organic Motion <small style="font-weight:normal;color:#646970">v<?php echo esc_html(self::VERSION); ?></small></h1>
        <p>Configure your motion system here. In WPBakery, add the relevant class to <strong>Extra class name</strong> on a Row, Text Block, or image element.</p>
        <style>
        .dm-settings{max-width:1080px}.dm-settings .dm-tab-links{display:flex;gap:6px;margin:22px 0 0;border-bottom:1px solid #c3c4c7;flex-wrap:wrap}
        .dm-settings .dm-tab-links button{border:1px solid transparent;border-radius:5px 5px 0 0;padding:11px 18px;background:transparent;cursor:pointer;font-weight:600;color:#50575e}
        .dm-settings .dm-tab-links button[aria-selected="true"]{background:white;border-color:#c3c4c7;border-bottom-color:#fff;color:#135e96;margin-bottom:-1px}
        .dm-settings .dm-panel{display:none;background:#fff;border:1px solid #c3c4c7;border-top:0;padding:22px 28px 18px}
        .dm-settings .dm-panel.dm-active{display:block}.dm-settings .dm-panel h2{margin-top:0}
        .dm-settings .dm-color-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;max-width:920px}
        .dm-settings .dm-color-field{display:flex;flex-direction:column;align-items:start;gap:7px;padding:12px;border:1px solid #ddd;border-radius:6px}
        .dm-settings .dm-color-field input{width:92px;height:42px;padding:2px;cursor:pointer}.dm-settings .dm-tip{background:#f6f7f7;border-left:3px solid #2271b1;padding:11px 15px;max-width:860px}
        .dm-settings .dm-help{max-width:880px}.dm-settings .dm-help td{vertical-align:middle}.dm-settings .dm-demo{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.dm-settings .dm-demo code{font-size:13px}
        @media(max-width:750px){.dm-settings .dm-panel{padding:16px}.dm-settings .dm-tab-links button{padding:9px}}
        </style>
        <form method="post" action="options.php">
          <?php settings_fields('ferm_motion'); ?>
          <nav class="dm-tab-links" aria-label="Motion settings categories" role="tablist">
            <?php foreach(array('general'=>'General','typography'=>'Typography','images'=>'Images','parallax'=>'Parallax','scroll'=>'Scroll','colours'=>'Colours','header'=>'Header','sliders'=>'Sliders') as $key=>$label): ?>
              <button type="button" role="tab" id="dm-tab-<?php echo esc_attr($key); ?>" data-dm-tab="<?php echo esc_attr($key); ?>" aria-controls="dm-panel-<?php echo esc_attr($key); ?>" aria-selected="<?php echo $key==='general'?'true':'false'; ?>"><?php echo esc_html($label); ?></button>
            <?php endforeach; ?>
          </nav>
          <div role="tabpanel" id="dm-panel-general" class="dm-panel dm-active" aria-labelledby="dm-tab-general">
            <h2>General motion</h2><p>Shared timing and animation behaviour across the site.</p>
            <table class="form-table" role="presentation"><tbody>
            <tr><th scope="row">Enable animations</th><td><label><input type="checkbox" name="<?php echo esc_attr(self::OPTION); ?>[enabled]" value="1" <?php checked($s['enabled'],1); ?>> Enable Organic Motion</label></td></tr>
            <?php self::field('duration','Reveal duration',250,2400,'ms');self::field('distance','Reveal movement',0,120,'px');self::field('stagger','Stagger between items or words',0,600,'ms'); ?>
            <tr><th scope="row">Repeat behaviour</th><td><label><input type="checkbox" name="<?php echo esc_attr(self::OPTION); ?>[once]" value="1" <?php checked($s['once'],1); ?>> Reveal only once per page visit</label></td></tr>
            </tbody></table><p class="dm-tip">All effects respect reduced-motion preferences. Content stays visible if the plugin is disabled.</p>
          </div>
          <div role="tabpanel" id="dm-panel-typography" class="dm-panel" aria-labelledby="dm-tab-typography">
            <h2>Typography</h2><p>Word, line, and whole-block reveals. The global stagger value controls the interval between words.</p>
            <table class="form-table" role="presentation"><tbody>
            <?php self::field('text_trigger','Text trigger position',10,95,'% down the viewport'); ?>
            </tbody></table>
            <table class="widefat striped dm-help"><thead><tr><th>Class</th><th>Usage</th></tr></thead><tbody>
            <tr><td><code>dm-reveal</code></td><td>Fade and rise into view</td></tr>
            <tr><td><code>dm-words</code></td><td>Words appear sequentially, preserving manual line breaks. Perfect for Droom. Denk. / Durf. Doe.</td></tr>
            <tr><td><code>dm-words dm-words-manual</code></td><td>Manually wrapped words for precise art-directed layout</td></tr>
            <tr><td><code>dm-lines</code></td><td>Lines separated by authored &lt;br&gt; elements</td></tr>
            <tr><td><code>dm-stagger</code></td><td>Children reveal one by one</td></tr>
            </tbody></table>
          </div>
          <div role="tabpanel" id="dm-panel-images" class="dm-panel" aria-labelledby="dm-tab-images">
            <h2>Image reveals</h2><p>Reveal ordinary images and row background photography without exposed strips at the edges. <strong>Background size, repeat and position now inherit WPBakery / Impreza settings, including responsive changes.</strong> For background parallax only, adjust overscan in the Parallax tab; 0% preserves exact framing.</p>
            <table class="form-table" role="presentation"><tbody>
            <?php self::field('image_trigger','Image trigger position',10,95,'% down the viewport (smaller = later)'); ?>
            </tbody></table>
            <table class="widefat striped dm-help"><thead><tr><th>Class</th><th>Usage</th></tr></thead><tbody>
            <tr><td><code>dm-image</code></td><td>WPBakery Single Image wrapper</td></tr>
            <tr><td><code>dm-bg-reveal</code></td><td>WPBakery/Impreza row with a background photograph</td></tr>
            </tbody></table>
          </div>
          <div role="tabpanel" id="dm-panel-parallax" class="dm-panel" aria-labelledby="dm-tab-parallax">
            <h2>Parallax and floating</h2><p>The photo or inner content moves. Row boundaries and backgrounds remain aligned with adjacent sections.</p>
            <table class="form-table" role="presentation"><tbody>
            <?php self::field('image_parallax_percent','Image parallax',0,30,'% of element height (total travel)');self::field('image_parallax_radius','Image parallax corner radius',0,200,'px (0 uses the existing image styling)');self::ease_field('image_easing','Image easing'); ?>
            <?php self::field('organic_travel_percent','Organic Parallax travel',0,30,'% of image height (total travel)'); ?>
            <?php self::field('organic_intensity','Organic intensity',0,200,'% drift and zoom'); ?>
            <tr><th scope="row"><label for="dm-organic-easing">Organic easing</label></th><td>
              <select id="dm-organic-easing" name="<?php echo esc_attr(self::OPTION); ?>[organic_easing]">
                <option value="linear" <?php selected($s['organic_easing'],'linear'); ?>>Linear</option>
                <option value="editorial" <?php selected($s['organic_easing'],'editorial'); ?>>Editorial</option>
                <option value="bubble" <?php selected($s['organic_easing'],'bubble'); ?>>Bubble</option>
              </select>
            </td></tr>
            <?php self::field('background_parallax_percent','Background-image parallax',0,30,'% of element height (total travel)');self::ease_field('background_easing','Background easing');self::field('background_overscan','Background photo overscan',0,30,'% (0 = exact sizing; higher = fewer exposed edges)');self::field('section_parallax_percent','Section-content parallax',0,30,'% of element height (total travel)');self::ease_field('section_easing','Section easing');self::field('parallax_percent','Legacy graphic parallax',0,30,'% of element height (total travel)');self::ease_field('parallax_easing','Graphic easing'); ?>
            </tbody></table>
            <p class="dm-tip">Easing makes the visual element catch up with the scroll. It does not slow or block the page itself. Direct follows immediately; Soft and Cinematic add progressively more inertia.</p>
            <p><code>dm-image-parallax</code> on a single image, or <code>dm-organic-parallax</code> for subtle zoom and drift; <code>dm-bg-parallax</code> on a photo row; <code>dm-section-parallax</code> on a content row; <code>dm-float</code> on an individual illustration.</p>
          </div>
          <div role="tabpanel" id="dm-panel-colours" class="dm-panel" aria-labelledby="dm-tab-colours">
            <h2>Scroll colour flow</h2><p class="description">Two simple controls: where colours change, and how gently. No scroll speed modification or section translation.</p>
            <p>Name the swatches and set their colours here. Use the class shown below each swatch in WPBakery. Then give each consecutive WPBakery row <code>dm-color-flow</code> plus a colour class. The plugin gradually blends between them while scrolling. The <strong>row itself never moves</strong>.</p>
            <div class="dm-color-grid">
              <?php self::color_field('cream','Cream','cream');self::color_field('orange','Orange','orange');self::color_field('green','Green','green');self::color_field('pink','Pink','pink');self::color_field('ink','Ink','ink'); ?>
            </div>
            <table class="form-table" role="presentation"><tbody>
            <tr><th scope="row">Enable scroll colour flow</th><td><label><input type="checkbox" name="<?php echo esc_attr(self::OPTION); ?>[color_enabled]" value="1" <?php checked($s['color_enabled'],1); ?>> Animate between marked sections</label></td></tr>
            <?php self::field('color_position','Transition position',15,85,'% down viewport'); ?>
            <tr><th scope="row">Blend softness</th><td><select name="<?php echo esc_attr(self::OPTION); ?>[color_softness]"><option value="tight" <?php selected($s['color_softness'],'tight'); ?>>Tight — defined colour change</option><option value="balanced" <?php selected($s['color_softness'],'balanced'); ?>>Balanced — editorial (recommended)</option><option value="atmospheric" <?php selected($s['color_softness'],'atmospheric'); ?>>Atmospheric — long gradual blend</option></select></td></tr>
            <tr><th scope="row">Easing</th><td><select name="<?php echo esc_attr(self::OPTION); ?>[color_easing]"><option value="smooth" <?php selected($s['color_easing'],'smooth'); ?>>Smooth (recommended)</option><option value="linear" <?php selected($s['color_easing'],'linear'); ?>>Linear</option></select></td></tr>
            </tbody></table>
            <p class="dm-tip">Add <code>dm-color-break</code> to a destination row to prevent a fade from the previous colour while keeping its fade to the following row. Example: orange → green, hard cut to cream, then cream → pink. The transition is centred around the chosen viewport position. Softness controls the length of the blend. For a seamless effect, put these classes on full-width adjacent rows. Do not apply colour flow to photographic rows.</p>
            <h3>WPBakery example</h3><p>Extra class name of each relevant row:</p>
            <div class="dm-demo"><code>dm-color-flow dm-color-cream</code><span>→</span><code>dm-color-flow dm-color-orange</code><span>→</span><code>dm-color-flow dm-color-green</code><span>→</span><code>dm-color-flow dm-color-pink</code></div>
            <p><strong>Footer connection:</strong> Add <code>dm-color-to-footer</code> to your final <code>dm-color-flow</code> row to blend the last row into the FERM Ink palette swatch (or a custom <code>data-dm-footer-color</code> HEX value). The plugin never repaints the footer itself. Leave this class off for a hard section-to-footer edge.</p>
            <p><strong>Separate colour sequences:</strong> <code>dm-color-flow dm-color-orange</code> → <code>dm-color-flow dm-color-green</code> → <code>dm-color-flow dm-color-cream dm-color-break</code> → <code>dm-color-flow dm-color-pink</code>. The cream section cuts in immediately, then fades toward pink.</p>
            <p>If you use a Raw HTML wrapper, you can also define any HEX colour with <code>data-dm-color="#abcdef"</code>.</p>
          </div>
          <div role="tabpanel" id="dm-panel-header" class="dm-panel" aria-labelledby="dm-tab-header">
            <h2>Adaptive header</h2>
            <p class="description">An independent header system with its own timing. Optional, off by default. Follow the colour of the section directly behind the header, not the section occupying most of the viewport. Built for Impreza's <code>.l-header</code> structure.</p>
            <table class="form-table" role="presentation"><tbody>
              <tr><th scope="row">Enable adaptive header</th><td><label><input type="checkbox" name="<?php echo esc_attr(self::OPTION); ?>[header_enabled]" value="1" <?php checked($s['header_enabled'],1); ?>> Adapt header colours on scroll</label></td></tr>
              <tr><th scope="row">Header appearance</th><td><select name="<?php echo esc_attr(self::OPTION); ?>[header_mode]">
                <option value="transparent" <?php selected($s['header_mode'],'transparent'); ?>>Transparent — adapt logo/navigation contrast</option>
                <option value="match" <?php selected($s['header_mode'],'match'); ?>>Match section — adapt background and contrast</option>
              </select></td></tr>
              <tr><th scope="row">Text and icon contrast</th><td><select name="<?php echo esc_attr(self::OPTION); ?>[header_contrast]">
                <option value="auto" <?php selected($s['header_contrast'],'auto'); ?>>Automatic (recommended)</option>
                <option value="theme" <?php selected($s['header_contrast'],'theme'); ?>>Keep theme colours</option>
                <option value="light" <?php selected($s['header_contrast'],'light'); ?>>Always Cream</option>
                <option value="dark" <?php selected($s['header_contrast'],'dark'); ?>>Always Ink</option>
              </select></td></tr>
              <tr><th scope="row">Transition easing</th><td><select name="<?php echo esc_attr(self::OPTION); ?>[header_easing]">
                <option value="follow" <?php selected($s['header_easing'],'follow'); ?>>Follow section background (recommended)</option>
                <option value="quick" <?php selected($s['header_easing'],'quick'); ?>>Quick — 180 ms ease-out</option>
                <option value="soft" <?php selected($s['header_easing'],'soft'); ?>>Soft — 480 ms editorial</option>
                <option value="cinematic" <?php selected($s['header_easing'],'cinematic'); ?>>Cinematic — 800 ms gradual</option>
              </select><p class="description">Follow uses the background colour-flow engine's live blended colour without another delayed transition. Independent modes smooth the header separately.</p></td></tr>
              <tr><th scope="row">Header CSS selector</th><td><input class="regular-text" type="text" name="<?php echo esc_attr(self::OPTION); ?>[header_selector]" value="<?php echo esc_attr($s['header_selector']); ?>" placeholder=".l-header"> <p class="description">Default <code>.l-header</code> (Impreza). Change only if your header has a different wrapper.</p></td></tr>
              <tr><th scope="row">Monochrome image logo</th><td><label><input type="checkbox" name="<?php echo esc_attr(self::OPTION); ?>[header_mono_logo]" value="1" <?php checked($s['header_mono_logo'],1); ?>> Also recolour the logo if it is a one-colour image</label><p class="description">Leave off for multicolour, photographic or temporary FERM logos. Inline SVG logos using <code>currentColor</code> adapt automatically.</p></td></tr>
            </tbody></table>
            <p class="dm-tip">Works best with <code>dm-color-flow dm-color-green</code> and other FERM colour classes. On other rows, set <code>data-dm-header-bg="#507568"</code> on the section if necessary. Use <code>dm-header-light</code> or <code>dm-header-dark</code> on a section to override automatic foreground contrast, for example on photographic sections. Some opaque Impreza header variants may require using the <strong>Match section</strong> setting instead of Transparent.</p>
          </div>
          <div role="tabpanel" id="dm-panel-sliders" class="dm-panel" aria-labelledby="dm-tab-sliders">
            <h2>Image sliders</h2>
            <p>Create photographic sliders using images from the WordPress Media Library. Choose <strong>Editorial</strong> for one large image with a peek of the next, or <strong>Gallery</strong> for multiple images in a row.</p>
            <p><a class="button button-primary" href="<?php echo esc_url(admin_url('edit.php?post_type=ferm_slider')); ?>">Manage sliders</a> <a class="button" href="<?php echo esc_url(admin_url('post-new.php?post_type=ferm_slider')); ?>">Add new slider</a></p>
            <p class="dm-tip">Paste <code>[ferm_slider id="123"]</code> into a WPBakery Text Block (or Raw HTML element that processes shortcodes). The slider output is styled separately from motion classes, so no existing animations are affected.</p>
            <p>Choose horizontal or vertical image flow, with optional page-scroll acceleration and easing. Arrows centre the next or previous photo. Page-scroll influence and seamless looping are optional. Drag/swipe can be turned off for each slider.</p>
          </div>
          <div role="tabpanel" id="dm-panel-scroll" class="dm-panel" aria-labelledby="dm-tab-scroll">
            <h2>Smooth scrolling · Lenis</h2>
            <p>Optional smooth scroll for the whole page, with native scrolling as fallback. Unlike the previous wheel-resistance experiment, this provides consistent interpolation without shifting WPBakery sections, backgrounds or sticky labels.</p>
            <table class="form-table" role="presentation"><tbody>
              <tr><th scope="row">Smooth scrolling</th><td><label><input type="checkbox" name="<?php echo esc_attr(self::OPTION); ?>[scroll_enabled]" value="1" <?php checked($s['scroll_enabled'],1); ?>> Enable Lenis (off by default)</label><p class="description">Uses a pinned Lenis JavaScript build from jsDelivr. If unavailable, normal browser scrolling remains.</p></td></tr>
              <?php self::field('scroll_smoothing','Smoothing',4,22,'/ 100 (10 = 0.10; lower feels heavier)'); ?>
              <?php self::field('scroll_wheel','Wheel response',50,140,'% (85 = 0.85×)'); ?>
              <tr><th scope="row">Content focus</th><td><select name="<?php echo esc_attr(self::OPTION); ?>[scroll_focus]">
                <?php foreach(array('off'=>'Off (recommended initially)','gentle'=>'Gentle approach resistance','defined'=>'More pronounced approach resistance') as $value=>$label)printf('<option value="%s" %s>%s</option>',esc_attr($value),selected($s['scroll_focus'],$value,false),esc_html($label)); ?>
              </select><p class="description">Optional: affects the wheel input near <code>dm-scroll-focus</code> sections, without snapping or preventing scrolling. Disabled on mobile and for reduced-motion preferences.</p></td></tr>
            </tbody></table>
            <p class="dm-tip">Start with smoothing 10 and wheel 85%, content focus Off. Do not run other smooth-scroll plugins simultaneously. Add <code>data-lenis-prevent</code> to nested custom scroll containers if needed.</p>
          </div>
          <?php submit_button('Save Organic Motion settings'); ?>
        </form>
        <details style="margin-top:16px"><summary><strong>Diagnostics and advanced usage</strong></summary>
          <p>On a published page, open developer tools and run <code>window.FERMMotion?.diagnostics()</code>. Clear SG Cache after updating.</p>
          <p>Optional per-element attributes: <code>data-dm-duration="1200"</code>, <code>data-dm-distance="24"</code>, <code>data-dm-stagger="150"</code>, <code>data-dm-word-delay="140"</code>, <code>data-dm-trigger="40"</code>, <code>data-dm-parallax="35"</code> and <code>data-dm-bg-url="https://example.com/photo.jpg"</code>. Advanced per-row background overrides: <code>data-dm-bg-position="60% 30%"</code>, <code>data-dm-bg-size="contain"</code>, <code>data-dm-bg-overscan="0"</code>.</p>
        </details>
        <script>
        (function(){
          var root=document.querySelector('.dm-settings');if(!root)return;
          var tabs=Array.from(root.querySelectorAll('[data-dm-tab]'));
          function activate(key){
            tabs.forEach(function(tab){var match=tab.dataset.dmTab===key;tab.setAttribute('aria-selected',match?'true':'false');tab.tabIndex=match?0:-1;});
            root.querySelectorAll('.dm-panel').forEach(function(panel){panel.classList.toggle('dm-active',panel.id==='dm-panel-'+key);});
            try{history.replaceState(null,'',location.pathname+location.search+'#'+key);}catch(e){}
          }
          tabs.forEach(function(tab){tab.addEventListener('click',function(){activate(tab.dataset.dmTab);});});
          var valid=tabs.map(function(t){return t.dataset.dmTab;});var hash=location.hash.slice(1);
          if(valid.indexOf(hash)!==-1)activate(hash);
        })();
        </script>
        </div><?php
    }

}
require_once plugin_dir_path(__FILE__) . 'sliders.php';
require_once plugin_dir_path(__FILE__) . "opstellingen.php";
FERM_Motion::init();
