<?php
if (!defined('ABSPATH')) { exit; }

function ferm_opstellingen_fields() {
    return array(
        'font' => array('textfield', 'Font family', '', 'Leave blank to inherit the theme font. Use the name of a font already loaded on the site.'),
        'text_side' => array('dropdown', 'Text side', array('Right' => 'right', 'Left' => 'left'), 'Sets the position of the setup list on desktop.'),
        'hover_color' => array('colorpicker', 'Hover colour', '#263723', ''),
        'active_color' => array('colorpicker', 'Active colour', '#263723', ''),
        'radius' => array('textfield', 'Image corner radius', '12', 'Pixels. Use 0 for square corners.'),
        'image_layout' => array('dropdown', 'Image layout', array('Side by side' => 'split', 'Full width' => 'full'), 'Full width places the setup list below the photo.'),
        'image_width' => array('textfield', 'Image column width', '57', 'Percentage of the available column space. The text column takes the remainder.'),
    );
}

add_action('vc_before_init', function () {
    $params = array();
    foreach (ferm_opstellingen_fields() as $key => $field) {
        list($type, $label, $value, $description) = $field;
        $param = array('type' => $type, 'heading' => $label, 'param_name' => $key, 'value' => $value, 'description' => $description);
        if (in_array($key, array('text_side', 'image_width'), true)) {
            $param['dependency'] = array('element' => 'image_layout', 'value' => 'split');
        }
        $params[] = $param;
    }
    vc_map(array('name' => 'FERM Opstellingen', 'base' => 'ferm_opstellingen', 'category' => 'Organic Motion', 'params' => $params));
});

function ferm_opstellingen_text_color($hex) {
    $rgb = substr($hex, 1);
    if (strlen($rgb) === 3) { $rgb = preg_replace('/(.)/', '$1$1', $rgb); }
    $channels = array_map(function ($value) {
        $n = hexdec($value) / 255;
        return $n <= .04045 ? $n / 12.92 : pow(($n + .055) / 1.055, 2.4);
    }, str_split($rgb, 2));
    return .2126 * $channels[0] + .7152 * $channels[1] + .0722 * $channels[2] > .179 ? '#000' : '#fff';
}

add_shortcode('ferm_opstellingen', function ($attributes) {
    $defaults = array();
    foreach (ferm_opstellingen_fields() as $key => $field) {
        $defaults[$key] = is_array($field[2]) ? reset($field[2]) : $field[2];
    }
    $options = shortcode_atts($defaults, $attributes, 'ferm_opstellingen');
    $active = sanitize_hex_color($options['active_color']) ?: $defaults['active_color'];
    $hover = sanitize_hex_color($options['hover_color']) ?: $defaults['hover_color'];
    $font = trim($options['font']);
    $image_width = max(25, min(75, (int) $options['image_width']));
    $style = sprintf('--fo-active:%s;--fo-hover:%s;--fo-active-text:%s;--fo-hover-text:%s;--fo-radius:%dpx;--fo-image:%dfr;--fo-text:%dfr;',
        $active, $hover, ferm_opstellingen_text_color($active), ferm_opstellingen_text_color($hover),
        max(0, min(200, (int) $options['radius'])), $image_width, 100 - $image_width);
    if ($font !== '' && preg_match('/^[\p{L}\p{N} ,\x22\x27_-]+$/u', $font)) { $style .= 'font-family:' . $font . ';'; }
    $layout = $options['image_layout'] === 'full' ? ' fo-full' : ($options['text_side'] === 'left' ? ' fo-text-left' : '');
    $base = trailingslashit(wp_get_upload_dir()["baseurl"]) . "2025/12/";
    $slides = array(
        array('Café-opstelling', '12–24 personen', 'ferm_schiedamde_plek_opstelling_encafe', 24),
        array('Grote U-opstelling', '7–17 personen', '2-ferm_schiedamde_plek_opstelling_boardroom', 17),
        array('Boardroom', '6–20 personen', 'ferm_schiedamde_plek_opstelling_werksessie', 20),
        array('Workshop', '2–3 eilanden, tot 24 personen', 'ferm_schiedamde_plek_opstelling_workshop', 24),
        array('Theateropstelling', 'Tot 36 personen', 'ferm_schiedamde_plek_opstelling_auditorium', 36),
        array('Focusgroep', '8–18 personen', 'ferm_schiedamde_plek_opstelling_focusgroep', 18),
    );
    foreach ($slides as &$slide) { $slide[2] = $base . $slide[2] . '-1024x1024.jpg'; }
    unset($slide);
    wp_enqueue_style('ferm-opstellingen', plugin_dir_url(__FILE__) . 'opstellingen.css', array(), FERM_Motion::VERSION);
    wp_enqueue_script('ferm-opstellingen', plugin_dir_url(__FILE__) . 'opstellingen.js', array(), FERM_Motion::VERSION, true);
    ob_start();
    ?>
    <section class="ferm-opstellingen<?php echo esc_attr($layout); ?>" aria-label="Ruimteopstellingen"
        style="<?php echo esc_attr($style); ?>" data-setups="<?php echo esc_attr(wp_json_encode($slides)); ?>">
        <figure aria-label="Foto’s van de opstellingen" tabindex="0">
            <div class="fo-photo">
                <button class="fo-arrow fo-prev" type="button" aria-label="Vorige opstelling"><span aria-hidden="true">←</span></button>
                <button class="fo-arrow fo-next" type="button" aria-label="Volgende opstelling"><span aria-hidden="true">→</span></button>
            </div>
            <figcaption aria-live="polite"><strong></strong><span></span></figcaption>
        </figure>
        <div class="fo-controls">
            <div class="fo-filters"><label>Groepsgrootte
                <select class="fo-group-size">
                    <option value="">Alle opstellingen</option>
                    <option value="12">Tot 12 personen</option>
                    <option value="18">13–18 personen</option>
                    <option value="24">19–24 personen</option>
                    <option value="36">25–36 personen</option>
                </select>
            </label></div>
            <div class="fo-list" role="group" aria-label="Kies een opstelling"><div class="fo-selection" aria-hidden="true"></div></div>
        </div>
    </section>
    <?php
    return ob_get_clean();
});
