define([
    "require",
    // For emitting events
    "dojo/Evented",
    // needed to create a class
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
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
    "dojo/promise/all",
    // wait for dom to be ready
    "dojo/domReady!"
],
  function (
    require,
    Evented,
    declare, lang, array,
    _WidgetBase, a11yclick, _TemplatedMixin,
    on,
    dijitTemplate,
    i18n,
    Query,
    string,
    query,
    domStyle, domClass, domAttr,
    Deferred,
    win,
    all
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
        sortField: null,
        activeSourceIndex: 0,
        pagination: true,
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
          form: "form",
          formInline: "form-inline",
          formGroup: "form-group",
          formControl: "form-control",
          hidden: "hidden"
        };
        // language
        this._i18n = i18n;
        this._dataObjectId = "data-objectid";
        this._deferreds = [];
        // mix in settings and defaults
        var defaults = lang.mixin({}, this.options, options);
        // create the DOM for this widget
        this.domNode = srcRefNode;
        // set properties
        this.set("theme", defaults.theme);
        this.set("map", defaults.map); // readonly todo
        this.set("sources", defaults.sources);
        this.set("num", defaults.num);
        this.set("start", defaults.start);
        this.set("order", defaults.order);
        this.set("sortField", defaults.sortField);
        this.set("activeSourceIndex", defaults.activeSourceIndex);
        this.set("visible", defaults.visible);
        this.set("count", defaults.count);
        this.set("pagination", defaults.pagination); // readonly todo
      },
      // _TemplatedMixin implements buildRendering() for you. Use this to override
      // buildRendering: function() {},
      // called after buildRendering() is finished
      postCreate: function () {
        if (this.pagination) {
          require(["./Pagination"], lang.hitch(this, function (Pagination) {
            this._pagination = new Pagination({
              num: this.num
            }, this._paginationNode);
            this._pagination.startup();
            this.own(on(this._pagination, "page", lang.hitch(this, function (e) {
              this.set("start", e.selectedResultStart);
            })));
          }));
        }
        this._displaySources();
        // set visibility
        this._updateVisible();
        var _self = this;
        this.own(on(this._layerNode, "change", lang.hitch(this, this._layerChange)));
        this.own(on(this._sortNode, "change", lang.hitch(this, this._sortChange)));
        this.own(on(this._orderNode, a11yclick, lang.hitch(this, this._orderClick)));
        this.own(on(this._resultsNode, "li:click", function () {
          _self._resultClick(this);
        }));
        this.own(on(this.map.infoWindow, "selection-change", lang.hitch(this, function (e) {
          var graphic = this.map.infoWindow.getSelectedFeature();
          if (graphic) {
            var layer = graphic.getLayer();
            var source = this.sources[this.activeSourceIndex];
            if (layer && source && layer === source.featureLayer) {
              if (graphic) {
                var id = graphic.attributes[layer.objectIdField];
              }
              this._resultHighlight(id);
            }
          }
        })));
      },

      destroy: function () {

        if (this._pagination) {
          this._pagination.destroy();
        }

        this.inherited(arguments);
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
        return this._selectFeature(feature);
      },
      /* ---------------- */
      /* Private Functions */
      /* ---------------- */
      _displaySources: function () {
        var promises = [];
        var html = "";
        var sources = this.sources;
        if (sources && sources.length > 1) {
          for (var i = 0; i < sources.length; i++) {
            promises.push(this._featureLayerLoaded(sources[i].featureLayer));
          }
          all(promises).then(lang.hitch(this, function () {
            for (var i = 0; i < sources.length; i++) {
              var source = sources[i];
              var name = source.name || source.featureLayer.name;
              var value = i;
              html += "<option value=\"" + value + "\">" + name + "</option>";
            }
            domClass.remove(this._layerArea, this.css.hidden);

            this._layerNode.innerHTML = html;
          }));
        } else {
          domClass.add(this._layerArea, this.css.hidden);
        }
      },
      _sortChange: function () {
        this.set("sortField", this._sortNode.value);
      },
      _layerChange: function () {
        var value = this._layerNode.value;
        var intVal = parseInt(value, 10);
        this.set("activeSourceIndex", intVal);
      },
      _orderClick: function () {
        var order = this.order.toUpperCase();
        var newOrder = "ASC";
        if (order === "ASC") {
          newOrder = "DESC";
        }
        this.set("order", newOrder);
      },
      _updateOrder: function () {
        var title, text;
        var order = this.order.toUpperCase();
        if (order === "DESC") {
          domClass.add(this._orderIconNode, this.css.sortDesc);
          domClass.remove(this._orderIconNode, this.css.sortAsc);
          title = i18n.descending;
          text = i18n.desc;
        } else {
          domClass.remove(this._orderIconNode, this.css.sortDesc);
          domClass.add(this._orderIconNode, this.css.sortAsc);
          title = i18n.ascending;
          text = i18n.asc;
        }
        this._orderTextNode.innerHTML = text;
        domAttr.set(this._orderNode, "title", title);
      },
      _updateFieldsMenu: function () {
        var source = this.sources[this.activeSourceIndex];
        var layer = source.featureLayer;
        this._featureLayerLoaded(layer).then(lang.hitch(this, function () {
          var fields = [];
          source.template.replace(/\$\{([^\s\:\}]+)(?:\:([^\s\:\}]+))?\}/g,
            function (match, key, format) {
              fields.push(key);
            });
          var html = "";

          if (fields && fields.length > 1) {
            array.forEach(layer.fields, function (item) {
              if (array.indexOf(fields, item.name) !== -1) {
                var alias = item.alias || item.name;
                html += "<option value=\"" + item.name + "\">" + alias + "</option>";
              }
            });
            domClass.remove(this._sortFieldArea, this.css.hidden);
          } else {
            domClass.add(this._sortFieldArea, this.css.hidden);
          }
          this._sortNode.innerHTML = html;


          if (fields[0]) {
            this.sortField = fields[0];
          } else {
            this.sortField = null;
          }

        }));
      },
      _removeResultsHighlight: function () {
        var q = query("li", this._resultsNode);
        for (var i = 0; i < q.length; i++) {
          domClass.remove(q[i], this.css.active);
        }
      },
      _resultHighlight: function (id, scrollIntoView) {
        this._removeResultsHighlight();
        var q = query("li[" + this._dataObjectId + "=" + id + "]", this._resultsNode);
        for (var i = 0; i < q.length; i++) {
          domClass.add(q[i], this.css.active);
          var active = domClass.contains(q[i], this.css.active);
          if (!active) {
            win.scrollIntoView(q[i]);
          }
        }

      },
      _resultClick: function (e) {
        var objectid = domAttr.get(e, this._dataObjectId);
        var active = domClass.contains(e, this.css.active);
        if (!active) {
          win.scrollIntoView(this.map.container);
          this._resultHighlight(objectid);
          this._selectObject(objectid);
        }
      },
      _cancelDeferreds: function () {
        // if we have deferreds
        if (this._deferreds && this._deferreds.length) {
          for (var i = 0; i < this._deferreds.length; i++) {
            // cancel deferred
            this._deferreds[i].cancel(this.declaredClass + " cancelling request");
          }
        }
        // remove deferreds
        this._deferreds = [];
      },
      _selectObject: function (objectid) {
        this._cancelDeferreds();
        var layer = this.sources[this.activeSourceIndex].featureLayer;
        var q = new Query();
        q.outSpatialReference = this.map.spatialReference;
        q.returnGeometry = true;
        q.where = layer.objectIdField + "=" + objectid;
        var def = layer.queryFeatures(q, lang.hitch(this, function (featureSet) {
          var feature;
          if (featureSet && featureSet.features && featureSet.features.length) {
            feature = featureSet.features[0];
          }
          this.select(feature);
        }), lang.hitch(this, function (error) {
          // todo
        }));
        this._deferreds.push(def);
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
              this.map.infoWindow.show(point);
            }));
          }
        }
      },
      _getFeatureCount: function () {
        var def = new Deferred();
        var source = this.sources[this.activeSourceIndex];
        var layer = source.featureLayer;
        this._featureLayerLoaded(layer).then(lang.hitch(this, function () {
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
          var fields = [];
          source.template.replace(/\$\{([^\s\:\}]+)(?:\:([^\s\:\}]+))?\}/g,
            function (match, key, format) {
              fields.push(key);
            });
          var hasObjectId = array.indexOf(fields, layer.objectIdField);
          if (hasObjectId === -1) {
            fields.push(layer.objectIdField);
          }
          var q = new Query();
          q.outSpatialReference = this.map.spatialReference;
          q.returnGeometry = false;
          q.where = "1=1";
          q.orderByFields = [this.sortField + " " + this.order];
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
          this.set("loaded", true);
          // emit event
          this.emit("load", {});
        }));
      },
      _sub: function (str) {
        if (!str) {
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
          html += "<li class=\"" + this.css.listItem + "\" " + this._dataObjectId + "=\"" + feature.attributes[layer.objectIdField] + "\">" + sub + "</li>";
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
      _layerChanged: function () {
        return this._getFeatureCount().then(lang.hitch(this, function (count) {
          this._updateFieldsMenu();
          this._updateOrder();
          this.set("count", count);
          this.set("start", 0);
        }));
      },
      /* ---------------- */
      /* Stateful Functions */
      /* ---------------- */
      _setActiveSourceIndexAttr: function (newVal) {
        this.activeSourceIndex = newVal;
        if (this._created) {
          this._layerChanged();
        }
      },
      _setNumAttr: function (newVal) {
        this.num = newVal;
        if (this._created) {
          this._getFeatures();
        }
      },
      _setSourcesAttr: function (newVal) {
        this.sources = newVal;
        if (this._created) {
          this._displaySources();
        }
      },
      _setStartAttr: function (newVal) {
        this.start = newVal;
        if (this._created) {
          this._getFeatures();
        }
      },
      _setCountAttr: function (newVal) {
        this.count = newVal;
        if (this._created) {
          if (this._pagination) {
            this._pagination.set("total", newVal);
          }
        }
      },
      _setOrderAttr: function (newVal) {
        this.order = newVal.toUpperCase();
        if (this._created) {
          this._updateOrder();
          if (this._pagination) {
            this._pagination.set("page", 0);
          }
          this.set("start", 0);
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
      _setSortFieldAttr: function (newVal) {
        this.sortField = newVal;
        if (this._created) {
          if (this._pagination) {
            this._pagination.set("page", 0);
          }
          this.set("start", 0);
        }
      },
      _setVisibleAttr: function (newVal) {
        this.visible = newVal;
        if (this._created) {
          this._updateVisible();
        }
      }
    });
  });