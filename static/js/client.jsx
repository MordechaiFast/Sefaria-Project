const $            = require('./sefaria/sefariaJquery'),
      React        = require('react'),
      ReactDOM     = require('react-dom'),
      DjangoCSRF   = require('./lib/django-csrf'),
      SefariaReact = require('./ReaderApp');


$(function() {
  var container = document.getElementById('s2');
  var component;
  DjangoCSRF.init();
  if (DJANGO_VARS.inReaderApp) {
    Sefaria.unpackDataFromProps(DJANGO_VARS.propsJSON);
    component = React.createElement(SefariaReact.ReaderApp, DJANGO_VARS.propsJSON);
    ReactDOM.render(component, container);
  } else if (DJANGO_VARS.containerId && DJANGO_VARS.reactComponentName) {
    container = document.getElementById(DJANGO_VARS.containerId);
    component = React.createElement(SefariaReact[DJANGO_VARS.reactComponentName], DJANGO_VARS.propsJSON);
    ReactDOM.render(component, container);
    ReactDOM.render(React.createElement(SefariaReact.Footer), document.getElementById('footer'));
  } else {
    var settings = {
      language: DJANGO_VARS.contentLang,
      layoutDefault: $.cookie("layoutDefault") || "segmented",
      layoutTalmud:  $.cookie("layoutTalmud")  || "continuous",
      layoutTanakh:  $.cookie("layoutTanakh")  || "segmented",
      color:         $.cookie("color")         || "light",
      fontSize:      $.cookie("fontSize")      || 62.5
    };
    var multiPanel    = $(window).width() > 600;
    component = React.createElement(SefariaReact.ReaderApp, {
      headerMode: true,
      multiPanel: multiPanel,
      initialRefs: [],
      initialFilter: [],
      initialMenu: null,
      initialQuery: null,
      initialSheetsTag: null,
      initialNavigationCategories: [],
      initialSettings: settings,
      initialPanels: [],
      interfaceLang: DJANGO_VARS.interfaceLang
    });
    ReactDOM.render(component, container);
    ReactDOM.render(React.createElement(SefariaReact.Footer), document.getElementById('footer'));
  }
});
