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
    "dojo/text!./FeatureNav/templates/FeatureNav.html",
    // localization
    "dojo/i18n!./FeatureNav/nls/FeatureNav",
    "esri/tasks/query",
    "dojo/string",
    "dojo/query",
    // dom manipulation
    "dojo/dom-style",
    "dojo/dom-class",
    "dojo/dom-attr",
    "dojo/Deferred",
    "dojo/window",

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
    query,
    domStyle, domClass, domAttr,
    Deferred,
    win
  ) {
    return declare([_WidgetBase, _TemplatedMixin, Evented], {
      // my html template string
      templateString: dijitTemplate,
      declaredClass: "dijit.FeatureNav",

      // default options
      options: {
        theme: "FeatureNav",
        map: null,
        sources: [],
        num: 10,
        start: 0,
        count: 0,
        order: "ASC",
        activeSourceIndex: 0,
        visible: true
      },

      /* ---------------- */
      /* Lifecycle methods */
      /* ---------------- */
      constructor: function (options, srcRefNode) {
        // css classes
        this.css = {
          list: "list-group",
          listItem: "list-group-item",
          active: "active",
          panel: "panel",
          panelBody: "panel-body",
          panelDefault: "panel-default",
          btn: "btn",
          btnDefault: "btn-default",
          glyphIcon: "glyphicon",
          sortAsc: "glyphicon-triangle-top",
          sortDesc: "glyphicon-triangle-bottom",
          form: "form-inline",
          formGroup: "form-group",
          formControl: "form-control"
        };
        // language
        this._i18n = i18n;
        // mix in settings and defaults
        var defaults = lang.mixin({}, this.options, options);
        // create the DOM for this widget
        this.domNode = srcRefNode;
        // set properties
        this.set("theme", defaults.theme);
        this.set("map", defaults.map);
        this.set("sources", defaults.sources);
        this.set("num", defaults.num);
        this.set("start", defaults.start);
        this.set("order", defaults.order);
        this.set("activeSourceIndex", defaults.activeSourceIndex);
        this.set("visible", defaults.visible);
        this.set("count", defaults.count);
      },
      // _TemplatedMixin implements buildRendering() for you. Use this to override
      // buildRendering: function() {},
      // called after buildRendering() is finished
      postCreate: function () {
        // set visibility
        this._updateVisible();
        this.own(on(this._sortNode, "change", lang.hitch(this, this._getFeatures)));
        this.own(on(this._orderNode, "click", lang.hitch(this, this._orderClick)));
        this.own(on(this._resultsNode, "li:click", lang.hitch(this, this._resultClick)));
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
          // todo
          console.log("test");
        }
      },
      /* ---------------- */
      /* Private Functions */
      /* ---------------- */
      _orderClick: function () {
        var order = this.order.toUpperCase();
        var newOrder = "ASC";
        if (order === "ASC") {
          newOrder = "DESC";
        }
        this.set("order", newOrder);
      },
      _updateOrder: function () {
        var title;
        var order = this.order.toUpperCase();
        if (order === "DESC") {
          domClass.add(this._orderIconNode, this.css.sortDesc);
          domClass.remove(this._orderIconNode, this.css.sortAsc);
          title = i18n.descending;
        } else {
          domClass.remove(this._orderIconNode, this.css.sortDesc);
          domClass.add(this._orderIconNode, this.css.sortAsc);
          title = i18n.ascending;
        }
        domAttr.set(this._orderNode, "title", title);
      },
      _updateSelectMenu: function () {
        var layer = this.sources[this.activeSourceIndex].featureLayer;
        this._featureLayerLoaded(layer).then(lang.hitch(this, function () {
          console.log(layer.fields);
          var fields = layer.fields;
          var html = "";
          for (var i = 0; i < fields.length; i++) {
            var field = fields[i];
            var alias = field.alias || field.name;
            html += "<option value=\"" + field.name + "\">" + alias + "</option>";
          }
          this._sortNode.innerHTML = html;
        }));
      },
      _resultHighlight: function (e) {
        var q = query("li", this._resultsNode);
        for (var i = 0; i < q.length; i++) {
          if (q[i] === e) {
            domClass.add(q[i], this.css.active);
            win.scrollIntoView(q[i]);
          } else {
            domClass.remove(q[i], this.css.active);
          }
        }
      },
      _resultClick: function (e) {
        var objectid = domAttr.get(e.target, "data-objectid");
        this._resultHighlight(e.target);
        this._selectObject(objectid);
      },
      _selectObject: function (objectid) {
        var layer = this.sources[this.activeSourceIndex].featureLayer;
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
      _getFeatureCount: function () {
        var def = new Deferred();
        var source = this.sources[this.activeSourceIndex];
        var layer = source.featureLayer;
        this._featureLayerLoaded(layer).then(lang.hitch(this, function () {
          var fields = source.outFields || layer.outFields;
          fields.push(layer.objectIdField);
          var q = new Query();
          q.returnGeometry = false;
          q.where = "1=1";
          layer.queryCount(q, lang.hitch(this, function (response) {
            def.resolve(response);
          }), lang.hitch(this, function (error) {
            def.reject(error);
          }));
        }), lang.hitch(this, function (error) {
          def.reject(error);
        }));
        return def;
      },
      _getFeatures: function () {
        var def = new Deferred();
        var source = this.sources[this.activeSourceIndex];
        var layer = source.featureLayer;
        if (this.map.infoWindow) {
          this.map.infoWindow.clearFeatures();
          this.map.infoWindow.hide();
        }
        this._featureLayerLoaded(layer).then(lang.hitch(this, function () {
          var fields = source.outFields || layer.outFields;
          fields.push(layer.objectIdField);
          var q = new Query();
          q.outSpatialReference = this.map.spatialReference;
          q.returnGeometry = false;
          q.where = "1=1";
          q.orderByFields = [this._sortNode.value + " " + this.order];
          q.outFields = fields;
          q.num = this.num;
          q.start = this.start;
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
        this._layerChanged().then(lang.hitch(this, function () {
          this._getFeatures().then(lang.hitch(this, function () {
            this.set("loaded", true);
            // emit event
            this.emit("load", {});
          }), lang.hitch(this, function (error) {
            console.error(error);
          }));
        }));
      },
      _sub: function (str) {
        if (!str) {
          return "Untitled";
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
          html += "<li class=\"" + this.css.listItem + "\" data-objectid=\"" + feature.attributes[layer.objectIdField] + "\">" + sub + "</li>";
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
      _layerClick: function () {
        var source = this.sources[this.activeSourceIndex];
        var layer = source.featureLayer;
        // remove event
        if (this._layerClickEvt) {
          this._layerClickEvt.remove();
        }
        // create event
        this._layerClickEvt = this.own(on(layer, "click", lang.hitch(this, function (e) {
          var graphic = e.graphic;
          var result;
          if (graphic) {
            var id = graphic.attributes[layer.objectIdField];
            if (id) {
              var q = query("li[data-objectid=" + id + "]", this._resultsNode);
              if (q && q.length) {
                result = q[0];
              }
            }
          }
          this._resultHighlight(result);
        })));
      },
      _layerChanged: function () {
        return this._getFeatureCount().then(lang.hitch(this, function (count) {
          this.set("count", count);
          this.set("start", 0);
          this._updateSelectMenu();
          this._updateOrder();
          this._layerClick();
        }));
      },
      /* ---------------- */
      /* Stateful Functions */
      /* ---------------- */
      _setActiveSourceIndexAttr: function (newVal) {
        this.activeSourceIndex = newVal;
        if (this._created) {
          this._layerChanged();
          this._getFeatures();
        }
      },
      _setNumAttr: function (newVal) {
        this.num = newVal;
        if (this._created) {
          this._getFeatures();
        }
      },
      _setStartAttr: function (newVal) {
        this.start = newVal;
        if (this._created) {
          this._getFeatures();
        }
      },
      _setOrderAttr: function (newVal) {
        this.order = newVal.toUpperCase();
        this.set("start", 0);
        if (this._created) {
          this._updateOrder();
          this._getFeatures();
        }
      },
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