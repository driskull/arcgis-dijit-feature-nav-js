define([
    // For emitting events
    "dojo/Evented",
    // needed to create a class
    "dojo/_base/declare",
    "dojo/_base/lang",
    // widget class
    "dijit/_WidgetBase",
    // accessibility click
    "dijit/a11yclick",
    // templated widget
    "dijit/_TemplatedMixin",
    // handle events
    "dojo/on",
    // load template
    "dojo/text!application/templates/FeatureNav.html",
    // localization
    "dojo/i18n!application/nls/FeatureNav",
    "esri/tasks/query",
    // dom manipulation
    "dojo/dom-style",
    "dojo/dom-class",
    "dojo/dom-attr",

    "dojo/Deferred",
    // wait for dom to be ready
    "dojo/domReady!"
],
  function (
    Evented,
    declare, lang,
    _WidgetBase, a11yclick, _TemplatedMixin,
    on,
    dijitTemplate,
    i18n,
    Query,
    domStyle, domClass, domAttr,
    Deferred
  ) {
    return declare("application.FeatureNav", [_WidgetBase, _TemplatedMixin, Evented], {
      // my html template string
      templateString: dijitTemplate,

      // default options
      options: {
        map: null,
        layers: [],
        visible: true
      },

      /* ---------------- */
      /* Lifecycle methods */
      /* ---------------- */
      constructor: function (options, srcRefNode) {
        // css classes
        this.css = {
          root: "test",
        };
        // language
        this._i18n = i18n;
        // mix in settings and defaults
        var defaults = lang.mixin({}, this.options, options);
        // create the DOM for this widget
        this.domNode = srcRefNode;
        // set properties
        this.set("map", defaults.map);
        this.set("layers", defaults.layers);
        this.set("visible", defaults.visible);
        // watch for changes
        this.watch("visible", this._visible);
      },
      // _TemplatedMixin implements buildRendering() for you. Use this to override
      // buildRendering: function() {},
      // called after buildRendering() is finished
      postCreate: function () {
        this._events();
      },
      // start widget. called by user
      startup: function () {
        // set visibility
        this._visible();
        if (this.map) {
          // when map is loaded
          if (this.map.loaded) {
            this._init();
          } else {
            on.once(this.map, "load", lang.hitch(this, function () {
              this._init();
            }));
          }
        } else {
          this._init();
        }
      },
      /* ---------------- */
      /* Public Functions */
      /* ---------------- */
      show: function () {
        this.set("visible", true);
      },
      hide: function () {
        this.set("visible", false);
      },
      /* ---------------- */
      /* Private Functions */
      /* ---------------- */
      _events: function () {
        this.own(on(this._resultsNode, "li:click", lang.hitch(this, this._resultClick)));
      },
      _resultClick: function (e) {
        var objectid = domAttr.get(e.target, "data-objectid");
        this._selectObject(objectid);
      },
      _selectObject: function (objectid) {
        var layer = this.layers[0];
        var q = new Query();
        q.outSpatialReference = this.map.spatialReference;
        q.returnGeometry = true;
        q.where = layer.objectIdField + "=" + objectid;
        q.outFields = ["*"];
        layer.queryFeatures(q, lang.hitch(this, function (featureSet) {
          var feature = featureSet.features[0];

          this._selectFeature(feature);

        }), lang.hitch(this, function (error) {

        }));
      },
      _selectFeature: function (feature) {
        var geometry = feature.geometry;
        var extent = geometry.getExtent();
        this.map.setExtent(extent, true);
        
        this.map.infoWindow.setFeatures([feature]);
        this.map.infoWindow.show(feature.geometry);
        
      },
      _init: function () {
        this.set("loaded", true);
        // emit event
        this.emit("load", {});

        if (this.layers && this.layers.length) {
          var layer = this.layers[0];

          this._featureLayerLoaded(layer).then(lang.hitch(this, function () {

            var q = new Query();
            q.outSpatialReference = this.map.spatialReference;
            q.returnGeometry = false;
            q.where = "1=1";
            q.orderByFields = [layer.displayField + " ASC"];
            q.outFields = [layer.objectIdField, layer.displayField];
            q.num = 10;
            //q.geometry = source.searchExtent;

            layer.queryFeatures(q, lang.hitch(this, function (featureSet) {
              this._displayResults(layer, featureSet);
            }), lang.hitch(this, function (error) {

            }));


          }));



        }


      },
      _displayResults: function (layer, featureSet) {


        var features = featureSet.features;
        var html = "";
        html += "<ul>";
        for (var i = 0; i < features.length; i++) {
          var feature = features[i];
          html += "<li data-objectid=\"" + feature.attributes[layer.objectIdField] + "\">" + feature.attributes[layer.displayField] + "</li>";
        }
        html += "</ul>";
        this._resultsNode.innerHTML = html;

      },
      _featureLayerLoaded: function (layer) {
        var def = new Deferred();
        if (layer.loaded) {
          // nothing to do
          def.resolve();
        } else if (layer.loadError) {
          def.reject(new Error(this._dijitName + " Layer failed to load."));
        } else {
          var loadedEvent, errorEvent;
          // once layer is loaded
          loadedEvent = on.once(layer, "load", lang.hitch(this, function () {
            errorEvent.remove();
            def.resolve();
          }));
          // error occurred loading layer
          errorEvent = on.once(layer, "error", lang.hitch(this, function () {
            loadedEvent.remove();
            def.reject(new Error(this._dijitName + " Layer could not be loaded."));
          }));
        }
        return def.promise;
      },
      _visible: function () {
        if (this.visible) {
          domStyle.set(this.domNode, "display", "block");
        } else {
          domStyle.set(this.domNode, "display", "none");
        }
      }
    });
  });