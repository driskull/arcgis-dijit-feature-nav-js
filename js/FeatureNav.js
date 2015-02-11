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
    "dojo/string",
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
    string,
    domStyle, domClass, domAttr,
    Deferred
  ) {
    return declare("application.FeatureNav", [_WidgetBase, _TemplatedMixin, Evented], {
      // my html template string
      templateString: dijitTemplate,

      // default options
      options: {
        theme: "FeatureNav",
        map: null,
        sources: [],
        activeSourceIndex: 0,
        visible: true
      },

      /* ---------------- */
      /* Lifecycle methods */
      /* ---------------- */
      constructor: function (options, srcRefNode) {
        // css classes
        this.css = {
          list: "list"
        };
        // language
        this._i18n = i18n;
        // mix in settings and defaults
        var defaults = lang.mixin({}, this.options, options);
        // create the DOM for this widget
        this.domNode = srcRefNode;
        // set properties
        this.set("map", defaults.map);
        this.set("sources", defaults.sources);
        this.set("visible", defaults.visible);
        this.set("theme", defaults.theme);
        this.set("activeSourceIndex", defaults.activeSourceIndex);
      },
      // _TemplatedMixin implements buildRendering() for you. Use this to override
      // buildRendering: function() {},
      // called after buildRendering() is finished
      postCreate: function () {
        this.own(on(this._resultsNode, "li:click", lang.hitch(this, this._resultClick)));
        // set visibility
        this._updateVisible();
      },
      // start widget. called by user
      startup: function () {
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
      select: function (feature) {
        if (feature) {
          this._selectFeature(feature);
        } else {

        }
      },
      /* ---------------- */
      /* Private Functions */
      /* ---------------- */
      _resultClick: function (e) {
        var objectid = domAttr.get(e.target, "data-objectid");
        this._selectObject(objectid);
      },
      _selectObject: function (objectid) {
        var layer = this.sources[0].featureLayer;
        var q = new Query();
        q.outSpatialReference = this.map.spatialReference;
        q.returnGeometry = true;
        q.where = layer.objectIdField + "=" + objectid;
        layer.queryFeatures(q, lang.hitch(this, function (featureSet) {
          var feature;
          if (featureSet && featureSet.features && featureSet.features.length) {
            feature = featureSet.features[0];
          }
          this.select(feature);
        }), lang.hitch(this, function (error) {

        }));
      },
      _selectFeature: function (feature) {
        if (feature) {
          var geometry = feature.geometry;
          if (geometry && geometry.type) {
            var extent, point;
            switch (geometry.type) {
            case "extent":
              extent = geometry;
              point = extent.getCenter();
              break;
            case "multipoint":
              extent = geometry.getExtent();
              point = extent.getCenter();
              break;
            case "point":
              point = geometry;
              break;
            case "polygon":
              extent = geometry.getExtent();
              point = extent.getCenter();
              break;
            case "polyline":
              extent = geometry.getExtent();
              point = extent.getCenter();
              break;
            }
            var zoomTo;
            if (extent) {
              zoomTo = this.map.setExtent(extent, true);
            } else if (point) {
              zoomTo = this.map.centerAt(point);
            }
            zoomTo.then(lang.hitch(this, function () {
              this.map.infoWindow.setFeatures([feature]);
              if (feature.infoTemplate) {
                this.map.infoWindow.show(point);
              }
            }));



          }
        }
      },
      _getFeatures: function (i) {
        var def = new Deferred();
        var source = this.sources[i];
        var layer = source.featureLayer;
        this._featureLayerLoaded(layer).then(lang.hitch(this, function () {
          var fields = source.displayFields;
          fields.push(layer.objectIdField);
          var q = new Query();
          q.outSpatialReference = this.map.spatialReference;
          q.returnGeometry = false;
          q.where = "1=1";
          q.orderByFields = [source.sortFields[0] + " " + source.defaultSortOrder];
          q.outFields = fields;
          q.num = 10;
          
          
          
          //q.geometry = source.searchExtent;
          layer.queryFeatures(q, lang.hitch(this, function (featureSet) {
            this._displayResults(layer, featureSet);
            def.resolve();
          }), lang.hitch(this, function (error) {
            def.reject(error);
          }));
        }), lang.hitch(this, function (error) {
          def.reject(error);
        }));
        return def;
      },
      _init: function () {
        this._getFeatures(this.activeSourceIndex).then(lang.hitch(this, function () {
          this.set("loaded", true);
          // emit event
          this.emit("load", {});
        }), lang.hitch(this, function (error) {
          console.error(error);
        }));
      },
      _sub: function(str){
        if(!str){
          return "";
        }
        return str;
      },
      _displayResults: function (layer, featureSet) {
        var features = featureSet.features;
        var source = this.sources[this.activeSourceIndex];
        var t = source.template;
        var html = "";
        html += "<ul class=\"" + this.css.list + "\">";
        for (var i = 0; i < features.length; i++) {
          var feature = features[i];
          var sub = string.substitute(t, feature.attributes, this._sub);
          html += "<li data-objectid=\"" + feature.attributes[layer.objectIdField] + "\">" + sub + "</li>";
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
      _updateVisible: function () {
        if (this.visible) {
          this.show();
        } else {
          this.hide();
        }
      },
      /* ---------------- */
      /* Stateful Functions */
      /* ---------------- */
      // note: changing the theme will require the developer to style the widget.
      _setThemeAttr: function (newVal) {
        if (this._created) {
          domClass.remove(this.domNode, this.theme);
          domClass.add(this.domNode, newVal);
        }
        this.theme = newVal;
      },
      _setVisibleAttr: function (newVal) {
        this.visible = newVal;
        if (this._created) {
          this._updateVisible();
        }
      }
    });
  });