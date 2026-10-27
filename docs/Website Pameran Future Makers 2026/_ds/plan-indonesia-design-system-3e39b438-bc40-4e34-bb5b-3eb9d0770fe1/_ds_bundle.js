/* @ds-bundle: {"format":4,"namespace":"PlanIndonesiaDesignSystem_3e39b4","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Doodle","sourcePath":"components/graphics/Doodle.jsx"},{"name":"Highlight","sourcePath":"components/graphics/Highlight.jsx"},{"name":"Quote","sourcePath":"components/graphics/Quote.jsx"},{"name":"StatCard","sourcePath":"components/graphics/StatCard.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"fbdbc2d55bd0","components/core/Button.jsx":"d93493ef53ed","components/core/Card.jsx":"22114ed2fbff","components/forms/Input.jsx":"93dee9cae1b8","components/graphics/Doodle.jsx":"2bbd1bf086b0","components/graphics/Highlight.jsx":"da8f5a170e0b","components/graphics/Quote.jsx":"353fd92a871e","components/graphics/StatCard.jsx":"ae5cda2256c6","ui_kits/campaign/Hero.jsx":"faf723685941","ui_kits/campaign/RegisterForm.jsx":"60cd31d7c2a8","ui_kits/campaign/Subtopics.jsx":"088af8f92fc7"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.PlanIndonesiaDesignSystem_3e39b4 = window.PlanIndonesiaDesignSystem_3e39b4 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
/**
 * Small status / category label. Solid or soft-tinted.
 */
function Badge({
  children,
  color = 'brand',
  variant = 'solid'
}) {
  const map = {
    brand: '--plan-blue',
    lightblue: '--light-blue',
    orange: '--orange',
    yellow: '--yellow',
    purple: '--purple',
    magenta: '--magenta',
    green: '--green',
    red: '--red',
    dark: '--dark-blue'
  };
  const v = `var(${map[color] || map.brand})`;
  const lightText = color === 'yellow' || color === 'lightblue' || color === 'green';
  const solid = {
    background: v,
    color: lightText ? 'var(--dark-blue)' : 'var(--white)',
    border: `2px solid ${v}`
  };
  const soft = {
    background: 'color-mix(in srgb, ' + v + ' 14%, white)',
    color: 'var(--dark-blue)',
    border: `2px solid transparent`
  };
  const outline = {
    background: 'transparent',
    color: 'var(--dark-blue)',
    border: `2px solid ${v}`
  };
  const style = variant === 'soft' ? soft : variant === 'outline' ? outline : solid;
  return /*#__PURE__*/React.createElement("span", {
    className: "pi-badge",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: 'var(--font-body)',
      fontWeight: 700,
      fontSize: 13,
      letterSpacing: '0.02em',
      padding: '4px 12px',
      borderRadius: 'var(--radius-pill)',
      lineHeight: 1.2,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Plan Indonesia primary action button.
 * Variants map to the palette: brand (Plan Blue), accent (Orange), dark, and outline/ghost.
 */
function Button({
  children,
  variant = 'brand',
  size = 'md',
  disabled = false,
  as = 'button',
  onClick,
  type = 'button',
  ...rest
}) {
  const sizes = {
    sm: {
      padding: '8px 16px',
      fontSize: 14
    },
    md: {
      padding: '12px 24px',
      fontSize: 16
    },
    lg: {
      padding: '16px 32px',
      fontSize: 18
    }
  };
  const palette = {
    brand: {
      bg: 'var(--plan-blue)',
      fg: 'var(--white)',
      border: 'var(--plan-blue)'
    },
    accent: {
      bg: 'var(--orange)',
      fg: 'var(--white)',
      border: 'var(--orange)'
    },
    dark: {
      bg: 'var(--dark-blue)',
      fg: 'var(--white)',
      border: 'var(--dark-blue)'
    },
    outline: {
      bg: 'transparent',
      fg: 'var(--plan-blue)',
      border: 'var(--plan-blue)'
    },
    ghost: {
      bg: 'transparent',
      fg: 'var(--plan-blue)',
      border: 'transparent'
    }
  };
  const p = palette[variant] || palette.brand;
  const s = sizes[size] || sizes.md;
  const Tag = as;
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    lineHeight: 1,
    padding: s.padding,
    fontSize: s.fontSize,
    color: p.fg,
    background: p.bg,
    border: `2px solid ${p.border}`,
    borderRadius: 'var(--radius-pill)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    textDecoration: 'none',
    transition: 'filter var(--duration) var(--ease-standard), transform var(--duration-fast) var(--ease-standard)',
    WebkitTapHighlightColor: 'transparent'
  };
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: "pi-button",
    style: style,
    onClick: disabled ? undefined : onClick,
    disabled: Tag === 'button' ? disabled : undefined,
    type: Tag === 'button' ? type : undefined
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Content card. Default is a clean white surface with soft shadow;
 * `accent` draws a top color bar; `filled` uses a brand background.
 */
function Card({
  children,
  variant = 'plain',
  color = 'brand',
  padding = 'var(--space-6)',
  as = 'div',
  ...rest
}) {
  const map = {
    brand: '--plan-blue',
    lightblue: '--light-blue',
    orange: '--orange',
    yellow: '--yellow',
    purple: '--purple',
    magenta: '--magenta',
    green: '--green',
    dark: '--dark-blue'
  };
  const v = `var(${map[color] || map.brand})`;
  const lightBg = color === 'yellow' || color === 'lightblue' || color === 'green';
  const base = {
    borderRadius: 'var(--radius-lg)',
    padding,
    fontFamily: 'var(--font-body)',
    color: 'var(--text-body)'
  };
  const variants = {
    plain: {
      background: 'var(--surface-card)',
      boxShadow: 'var(--shadow-md)'
    },
    outline: {
      background: 'var(--surface-card)',
      border: '2px solid var(--light-grey)'
    },
    accent: {
      background: 'var(--surface-card)',
      boxShadow: 'var(--shadow-md)',
      borderTop: `6px solid ${v}`
    },
    filled: {
      background: v,
      color: lightBg ? 'var(--dark-blue)' : 'var(--white)'
    }
  };
  const Tag = as;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: "pi-card",
    style: {
      ...base,
      ...(variants[variant] || variants.plain)
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Text input with label. Uses Arial body font and a 2px focus ring in Plan Blue.
 */
function Input({
  label,
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
  helpText,
  invalid = false,
  ...rest
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return /*#__PURE__*/React.createElement("div", {
    className: "pi-field",
    style: {
      fontFamily: 'var(--font-body)',
      display: 'grid',
      gap: 6
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      fontWeight: 700,
      fontSize: 14,
      color: 'var(--text-strong)'
    }
  }, label), /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    type: type,
    placeholder: placeholder,
    value: value,
    onChange: onChange,
    className: "pi-input",
    style: {
      font: 'inherit',
      fontSize: 16,
      padding: '10px 14px',
      borderRadius: 'var(--radius-md)',
      border: `2px solid ${invalid ? 'var(--red)' : 'var(--light-grey)'}`,
      background: 'var(--white)',
      color: 'var(--text-body)',
      outline: 'none',
      transition: 'border-color var(--duration) var(--ease-standard)'
    },
    onFocus: e => {
      if (!invalid) e.target.style.borderColor = 'var(--plan-blue)';
    },
    onBlur: e => {
      if (!invalid) e.target.style.borderColor = 'var(--light-grey)';
    }
  }, rest)), helpText && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: invalid ? 'var(--red)' : 'var(--text-muted)'
    }
  }, helpText));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/graphics/Doodle.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Hand-drawn doodle stroke — the brand's youthful accent device.
 * Renders as a single-color round-cap stroke (4–7px). Use one per visual (max two).
 */
function Doodle({
  shape = 'underline',
  color = 'brand',
  width = 220,
  strokeWidth = 5
}) {
  const map = {
    brand: '--plan-blue',
    yellow: '--yellow',
    orange: '--orange',
    magenta: '--magenta',
    purple: '--purple',
    green: '--green',
    lightblue: '--light-blue',
    dark: '--dark-blue'
  };
  const stroke = `var(${map[color] || map.brand})`;
  const common = {
    fill: 'none',
    stroke,
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  };
  // Loose, hand-drawn paths within a 100x28 viewBox.
  const shapes = {
    underline: /*#__PURE__*/React.createElement("path", _extends({
      d: "M4 18 C 26 24, 60 8, 96 16"
    }, common)),
    scribble: /*#__PURE__*/React.createElement("path", _extends({
      d: "M3 20 C 20 6, 34 26, 52 12 S 82 24, 97 10"
    }, common)),
    arrow: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", _extends({
      d: "M4 14 C 34 8, 66 20, 90 12"
    }, common)), /*#__PURE__*/React.createElement("path", _extends({
      d: "M78 5 L 92 12 L 80 20"
    }, common))),
    circle: /*#__PURE__*/React.createElement("path", _extends({
      d: "M50 4 C 20 3, 8 22, 30 25 C 62 28, 96 20, 88 10 C 82 3, 60 3, 44 5"
    }, common))
  };
  const height = Math.round(width / 100 * 28);
  return /*#__PURE__*/React.createElement("svg", {
    className: "pi-doodle",
    width: width,
    height: height,
    viewBox: "0 0 100 28",
    preserveAspectRatio: "none",
    "aria-hidden": "true",
    style: {
      display: 'block'
    }
  }, shapes[shape] || shapes.underline);
}
Object.assign(__ds_scope, { Doodle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/graphics/Doodle.jsx", error: String((e && e.message) || e) }); }

// components/graphics/Highlight.jsx
try { (() => {
/**
 * Signature Plan highlight — a solid rectangular block behind bold words,
 * used to emphasise up to three consecutive words (Poppins Bold).
 */
function Highlight({
  children,
  color = 'brand',
  textColor,
  as = 'span'
}) {
  const map = {
    brand: {
      bg: 'var(--plan-blue)',
      fg: 'var(--white)'
    },
    yellow: {
      bg: 'var(--yellow)',
      fg: 'var(--dark-blue)'
    },
    orange: {
      bg: 'var(--orange)',
      fg: 'var(--white)'
    },
    magenta: {
      bg: 'var(--magenta)',
      fg: 'var(--white)'
    },
    purple: {
      bg: 'var(--purple)',
      fg: 'var(--white)'
    },
    green: {
      bg: 'var(--green)',
      fg: 'var(--dark-blue)'
    },
    lightblue: {
      bg: 'var(--light-blue)',
      fg: 'var(--dark-blue)'
    },
    dark: {
      bg: 'var(--dark-blue)',
      fg: 'var(--white)'
    }
  };
  const c = map[color] || map.brand;
  const Tag = as;
  return /*#__PURE__*/React.createElement(Tag, {
    className: "pi-highlight",
    style: {
      fontFamily: 'var(--font-headline)',
      fontWeight: 700,
      background: c.bg,
      color: textColor || c.fg,
      padding: '0.04em 0.22em',
      boxDecorationBreak: 'clone',
      WebkitBoxDecorationBreak: 'clone',
      lineHeight: 1.35
    }
  }, children);
}
Object.assign(__ds_scope, { Highlight });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/graphics/Highlight.jsx", error: String((e && e.message) || e) }); }

// components/graphics/Quote.jsx
try { (() => {
/**
 * Editorial pull-quote. Quote text in Poppins Bold (or Georgia), attribution in Georgia.
 */
function Quote({
  children,
  cite,
  color = 'brand',
  font = 'headline'
}) {
  const map = {
    brand: '--plan-blue',
    orange: '--orange',
    magenta: '--magenta',
    dark: '--dark-blue',
    purple: '--purple'
  };
  const v = `var(${map[color] || map.brand})`;
  return /*#__PURE__*/React.createElement("figure", {
    className: "pi-quote",
    style: {
      margin: 0,
      borderLeft: `6px solid ${v}`,
      paddingLeft: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement("blockquote", {
    style: {
      margin: 0,
      fontFamily: font === 'serif' ? 'var(--font-caption)' : 'var(--font-headline)',
      fontWeight: font === 'serif' ? 400 : 700,
      fontStyle: font === 'serif' ? 'italic' : 'normal',
      fontSize: 'clamp(20px, 2.4vw, 28px)',
      lineHeight: 1.3,
      color: 'var(--text-strong)'
    }
  }, children), cite && /*#__PURE__*/React.createElement("figcaption", {
    style: {
      marginTop: 'var(--space-3)',
      fontFamily: 'var(--font-caption)',
      fontStyle: 'italic',
      fontSize: 14,
      color: 'var(--text-muted)'
    }
  }, cite));
}
Object.assign(__ds_scope, { Quote });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/graphics/Quote.jsx", error: String((e && e.message) || e) }); }

// components/graphics/StatCard.jsx
try { (() => {
/**
 * Big-number impact statistic — Poppins Bold figure over a short label.
 * Central to Plan reports and campaign visuals.
 */
function StatCard({
  value,
  label,
  color = 'brand',
  align = 'left'
}) {
  const map = {
    brand: '--plan-blue',
    orange: '--orange',
    magenta: '--magenta',
    purple: '--purple',
    green: '--green',
    dark: '--dark-blue'
  };
  const v = `var(${map[color] || map.brand})`;
  return /*#__PURE__*/React.createElement("div", {
    className: "pi-stat",
    style: {
      textAlign: align,
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-headline)',
      fontWeight: 800,
      fontSize: 'clamp(40px, 6vw, 64px)',
      lineHeight: 1,
      color: v,
      letterSpacing: '-0.02em'
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontSize: 15,
      lineHeight: 1.4,
      color: 'var(--text-body)',
      maxWidth: 260,
      marginLeft: align === 'center' ? 'auto' : 0,
      marginRight: align === 'center' ? 'auto' : 0
    }
  }, label));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/graphics/StatCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/campaign/Hero.jsx
try { (() => {
/* global React */
const {
  Button,
  Badge,
  Doodle
} = window.PlanIndonesiaDesignSystem_3e39b4;
function CampaignHeader({
  onRegister
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '18px 48px',
      background: '#fff',
      borderBottom: '1px solid var(--light-grey)',
      position: 'sticky',
      top: 0,
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-headline)',
      fontWeight: 800,
      fontSize: 20,
      color: 'var(--dark-blue)',
      lineHeight: 1
    }
  }, "Plan Indonesia", /*#__PURE__*/React.createElement("small", {
    style: {
      display: 'block',
      fontWeight: 400,
      fontSize: 11,
      color: 'var(--text-muted)'
    }
  }, "Sampai semua setara")), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      gap: 28,
      alignItems: 'center',
      fontFamily: 'var(--font-body)',
      fontWeight: 700,
      fontSize: 15
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#tentang",
    style: {
      color: 'var(--dark-blue)',
      textDecoration: 'none'
    }
  }, "Tentang"), /*#__PURE__*/React.createElement("a", {
    href: "#subtopik",
    style: {
      color: 'var(--dark-blue)',
      textDecoration: 'none'
    }
  }, "Subtopik"), /*#__PURE__*/React.createElement("a", {
    href: "#timeline",
    style: {
      color: 'var(--dark-blue)',
      textDecoration: 'none'
    }
  }, "Timeline"), /*#__PURE__*/React.createElement(Button, {
    variant: "brand",
    size: "sm",
    onClick: onRegister
  }, "Daftar sekarang")));
}
function CampaignHero({
  onRegister
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: 'var(--dark-blue)',
      color: '#fff',
      padding: '72px 48px 84px',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 720
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    color: "lightblue",
    variant: "soft"
  }, "Kompetisi Digital \xB7 2026"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-headline)',
      fontWeight: 800,
      fontSize: 64,
      lineHeight: 0.98,
      letterSpacing: '-0.02em',
      margin: '18px 0 0'
    }
  }, "InnovAItion", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      background: 'var(--yellow)',
      color: 'var(--dark-blue)',
      padding: '0 12px'
    }
  }, "Challenge")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(Doodle, {
    shape: "underline",
    color: "lightblue",
    width: 260,
    strokeWidth: 5
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 20,
      lineHeight: 1.5,
      opacity: 0.9,
      marginTop: 24,
      maxWidth: 560
    }
  }, "Building Inclusive Generative AI Skills for Youth. Tunjukkan bagaimana AI Generatif memberdayakan kaum muda lewat video kampanye Instagram Reels."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      marginTop: 32
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "accent",
    size: "lg",
    onClick: onRegister
  }, "Kirim karya kamu"), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "lg",
    as: "a",
    href: "#tentang",
    style: {
      color: '#fff',
      borderColor: 'rgba(255,255,255,.5)'
    }
  }, "Panduan kompetisi"))));
}
Object.assign(window, {
  CampaignHeader,
  CampaignHero
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/campaign/Hero.jsx", error: String((e && e.message) || e) }); }

// ui_kits/campaign/RegisterForm.jsx
try { (() => {
/* global React */
const {
  Input,
  Button,
  Badge,
  Card
} = window.PlanIndonesiaDesignSystem_3e39b4;
function RegisterForm({
  onDone
}) {
  const [form, setForm] = React.useState({
    nama: '',
    email: '',
    judul: '',
    tema: 'Karier'
  });
  const set = k => e => setForm(f => ({
    ...f,
    [k]: e.target.value
  }));
  const temas = ['Karier', 'Produktivitas', 'Belajar'];
  return /*#__PURE__*/React.createElement("section", {
    id: "daftar",
    style: {
      padding: '72px 48px',
      background: 'var(--plan-blue)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 640,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    variant: "plain",
    padding: "40px"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontWeight: 700,
      fontSize: 14,
      letterSpacing: '.14em',
      textTransform: 'uppercase',
      color: 'var(--plan-blue)'
    }
  }, "Pendaftaran"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-headline)',
      fontWeight: 800,
      fontSize: 34,
      color: 'var(--dark-blue)',
      letterSpacing: '-0.02em',
      margin: '10px 0 8px'
    }
  }, "Kirim karya kamu"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 15,
      color: 'var(--text-muted)',
      margin: '0 0 26px'
    }
  }, "Peserta wajib telah menyelesaikan modul \u201CBerinovasi dengan AI\u201D."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Nama lengkap / tim",
    placeholder: "Tulis nama kamu",
    value: form.nama,
    onChange: set('nama')
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Email",
    type: "email",
    placeholder: "nama@email.com",
    value: form.email,
    onChange: set('email')
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Judul karya",
    placeholder: "Judul video kampanye kamu",
    value: form.judul,
    onChange: set('judul')
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontWeight: 700,
      fontSize: 14,
      color: 'var(--text-strong)'
    }
  }, "Pilih subtopik"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 8,
      flexWrap: 'wrap'
    }
  }, temas.map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    onClick: () => setForm(f => ({
      ...f,
      tema: t
    })),
    style: {
      cursor: 'pointer',
      border: `2px solid ${form.tema === t ? 'var(--plan-blue)' : 'var(--light-grey)'}`,
      background: form.tema === t ? 'var(--plan-blue)' : '#fff',
      color: form.tema === t ? '#fff' : 'var(--dark-blue)',
      borderRadius: 999,
      padding: '8px 18px',
      fontFamily: 'var(--font-body)',
      fontWeight: 700,
      fontSize: 14
    }
  }, t)))), /*#__PURE__*/React.createElement(Button, {
    variant: "accent",
    size: "lg",
    onClick: () => onDone(form)
  }, "Kirim karya")))));
}
function SuccessPanel({
  form,
  onBack
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '96px 48px',
      background: 'var(--plan-blue)',
      minHeight: 420
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 620,
      margin: '0 auto',
      textAlign: 'center',
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    color: "green"
  }, "Karya terkirim"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-headline)',
      fontWeight: 800,
      fontSize: 44,
      letterSpacing: '-0.02em',
      margin: '20px 0 12px'
    }
  }, "Terima kasih", form.nama ? `, ${form.nama.split(' ')[0]}` : '', "!"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 18,
      opacity: 0.9,
      lineHeight: 1.5
    }
  }, "Karya \u201C", form.judul || 'tanpa judul', "\u201D untuk subtopik ", /*#__PURE__*/React.createElement("strong", null, form.tema), " sudah kami terima. Kami akan menghubungi kamu lewat ", form.email || 'email terdaftar', "."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 28
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "lg",
    onClick: onBack,
    style: {
      color: '#fff',
      borderColor: 'rgba(255,255,255,.6)'
    }
  }, "Kembali ke beranda"))));
}
Object.assign(window, {
  RegisterForm,
  SuccessPanel
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/campaign/RegisterForm.jsx", error: String((e && e.message) || e) }); }

// ui_kits/campaign/Subtopics.jsx
try { (() => {
/* global React */
const {
  Card,
  StatCard,
  Badge
} = window.PlanIndonesiaDesignSystem_3e39b4;
const SUBTOPICS = [{
  color: 'orange',
  tag: 'Karier',
  title: 'Kaum Muda Siap Berkarier dengan AI Generatif',
  body: 'Bagaimana AI Generatif membuka jalan karier baru dan memperkuat daya saing kaum muda.'
}, {
  color: 'magenta',
  tag: 'Produktivitas',
  title: 'AI Generatif untuk Produktivitas Kerja Sehari-hari',
  body: 'Trik nyata memakai AI Generatif untuk bekerja lebih cepat, rapi, dan kreatif.'
}, {
  color: 'purple',
  tag: 'Belajar',
  title: 'AI Generatif sebagai Teman Belajar',
  body: 'AI Generatif sebagai pendamping belajar yang inklusif dan mudah diakses.'
}];
function Subtopics() {
  return /*#__PURE__*/React.createElement("section", {
    id: "subtopik",
    style: {
      padding: '72px 48px',
      background: 'var(--surface-muted)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontWeight: 700,
      fontSize: 14,
      letterSpacing: '.14em',
      textTransform: 'uppercase',
      color: 'var(--plan-blue)'
    }
  }, "Subtopik"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-headline)',
      fontWeight: 800,
      fontSize: 40,
      color: 'var(--dark-blue)',
      letterSpacing: '-0.02em',
      margin: '10px 0 36px',
      maxWidth: 720
    }
  }, "Pilih satu tema untuk karya kamu"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 24
    }
  }, SUBTOPICS.map((s, i) => /*#__PURE__*/React.createElement(Card, {
    key: i,
    variant: "accent",
    color: s.color,
    padding: "28px"
  }, /*#__PURE__*/React.createElement(Badge, {
    color: s.color,
    variant: "soft"
  }, s.tag), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: 'var(--font-headline)',
      fontWeight: 700,
      fontSize: 22,
      color: 'var(--dark-blue)',
      lineHeight: 1.2,
      margin: '16px 0 10px'
    }
  }, s.title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 15,
      lineHeight: 1.55,
      color: 'var(--text-body)',
      margin: 0
    }
  }, s.body))))));
}
function ImpactStrip() {
  return /*#__PURE__*/React.createElement("section", {
    id: "tentang",
    style: {
      padding: '64px 48px',
      background: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: '0 auto',
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 32
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    value: "200",
    label: "karya video kampanye diajukan peserta",
    color: "brand"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: "18\u201329",
    label: "rentang usia peserta (hingga 35 untuk disabilitas)",
    color: "orange"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: "3",
    label: "subtopik AI Generatif untuk kaum muda",
    color: "magenta"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: "5 bln",
    label: "Juli hingga November 2026",
    color: "green"
  })));
}
Object.assign(window, {
  Subtopics,
  ImpactStrip
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/campaign/Subtopics.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Doodle = __ds_scope.Doodle;

__ds_ns.Highlight = __ds_scope.Highlight;

__ds_ns.Quote = __ds_scope.Quote;

__ds_ns.StatCard = __ds_scope.StatCard;

})();
