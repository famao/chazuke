//app
(function() {
  var app = {
    error: function(collection, response) {
      var message = "Unknown Error";
      message = response.statusText;
      switch (response.status) {
        case 0:
          message = "Server Connection failed";
          collection.unsetAuthData();
          break;
        case 400:
          message = "Invalid input error:" + response.responseJSON.error.message;
          break;
        case 401:
          message = "Unauthorized Error: please retry login";
          collection.unsetAuthData();
          break;
        case 404:
          message = "Data Not Found";
          break;
        case 500:
          message = "Server Side Error";
          break;
      }
      var html = JST['error.html']({
        message: message
      });
      if ($("#alerts_form").length > 0) {
        $("#alerts_form").html(html);
      } else {
        $("#alerts").html(html);
      }
    },
    AppView: Backbone.View.extend({
      mainview: null,
      className: 'appview',
      initialize: function(options) {
        var self = this;
        self.router = options.router;
        var config = options.config;
        self.config = config;
        self.viewClass = options.viewClass || {};

        if (config.auth_url.indexOf("__HOST__") > 0) {
          config.auth_url = config.auth_url.replace(
            "__HOST__", window.location.host);
        }
        if (config.gohan.url.indexOf("__HOST__") > 0) {
          config.gohan.url = config.gohan.url.replace(
            "__HOST__", window.location.host);
        }

        self.userModel = options.userModel;

        if(_.isUndefined(self.userModel)){
          self.userModel = new Gohan.UserModel({
            url: self.config.auth_url + "/tokens"
          });
        }

        self.buildView();

        self.schemas = options.scheams;

        if(_.isUndefined(self.schemas)){
          self.schemas = new Gohan.SchemaCollection({
            base_url: self.config.gohan.url,
            userModel: self.userModel,
            url: self.config.gohan.url + self.config.gohan.schema,
          });
        }

        self.listenTo(self.schemas, 'update', self.autoBuildUI);

        if(self.userModel.authToken()){
          self.schemas.fetch({
            'error': Gohan.error
          });
        }else{
          self.listenTo(self.userModel, 'change:auth_data', function () {
            self.$('#main_body').empty();
            self.schemas.fetch();
            self.render();
          });
        }
      },
      buildView: function(){
        this.sidebar_view = new Gohan.SidebarView({
          collection: new Backbone.Collection()
        });
        this.header_view = new Gohan.HeaderView({
          config: this.config,
          model: this.userModel
        });
      },
      get_param_from_query: function(){
        var params = {};
        var query_strings = document.location.search.substr(1)
        if(query_strings === ""){
            return params;
        }
        _.each(query_strings.split('&'), function(query){
            console.log(query)
            var i = query.split('=');
            params[i[0].toString()] = i[1].toString();
        });
        return params
      },
      autoBuildUIForSchema: function (schema){
        var self = this;
        var metadata = schema.get("metadata");
        var params = self.get_param_from_query()
        var type = params["type"] || "tenant"
        if(metadata && metadata.type != type){
            return
        }
        var viewClass = {
          table: Gohan.TableView,
          detail: Gohan.DetailView
        };
        _.extend(viewClass, self.viewClass[schema.id]);
        var collection =  schema.makeCollection();
        if(schema.hasParent()){
          var full_route = schema.url();
          full_route = full_route.substr(1);

          var child_table_view = function(){
            $("#alerts").empty();
            var endpoint = schema.apiEndpointBase() + '/' + Backbone.history.fragment;
            var collection = schema.makeCollection(endpoint);
            var tableView = new viewClass.table({
              schema: schema,
              collection: collection,
              childview: true,
              fragment: Backbone.history.fragment,
              app: self
            });
            self.$('#main_body').html(tableView.render().el);
            self.$('#main').addClass("active");
          };

          var child_detail_view = function() {
            $("#alerts").empty();
            var id = arguments[arguments.length - 2];
            var model = collection.get(id);

            if(_.isUndefined(model)){
              model = new collection.model({"id": id});
            }
            var detailView = new viewClass.detail({
              schema: schema,
              model: model,
              childview: true,
              fragment: Backbone.history.fragment,
              app: self
            });
            self.$('#main_body').html(detailView.render().el);
            self.$('#main').addClass("active");
          };
          self.router.route(full_route, "child_table_view", child_table_view);
          self.router.route(full_route + '/:id', "detail_view", child_detail_view);
        }else{
          var route = schema.get('url');
          route = route.substr(1);
          var sidebar_menu = self.sidebar_view.collection.push({
            path: "#" + route,
            title: schema.get('title'),
          });
          var table_view = function(id) {
            $("#alerts").empty();
            var tableView = new viewClass.table({
              schema: schema,
              collection: collection,
              fragment: Backbone.history.fragment,
              app: self
            });
            self.$('#main_body').html(tableView.render().el);
            self.$('#main').addClass("active");
            self.sidebar_view.select(sidebar_menu);
          };

          var detail_view = function(id) {
            $("#alerts").empty();
            var model = collection.get(id);
            if(_.isUndefined(model)){
              model = new collection.model({"id": id});
            }
            var detailView = new viewClass.detail({
              schema: schema,
              model: model,
              fragment: Backbone.history.fragment,
              app: self
            });
            self.$('#main_body').html(detailView.render().el);
            self.$('#main').addClass("active");
            self.sidebar_view.select(sidebar_menu);
          };

          self.router.route(route, "table_view", table_view);
          self.router.route(route + '/:id', "detail_view", detail_view);

        }
      },
      autoBuildUI: function() {
        var self = this;
        self.schemas.each(function(schema){
          self.autoBuildUIForSchema(schema)
        });
        Backbone.history.loadUrl(Backbone.history.fragment);
      },
      login: function(){
        var loginView = new Gohan.LoginView({
          model: this.userModel
        });
        this.$el.html(loginView.render().el);
      },
      render: function() {
        if(!this.userModel.authToken()){
          this.login();
        }else{
          this.$el.html(JST['app.html']());
          this.$('#header').append(this.header_view.render().el);
          this.$('#sidebar').append(this.sidebar_view.render().el);
        }
        return this;
      }})
  };
  if (!window.Gohan) window.Gohan = {};
  _.extend(Gohan, app);
})();

//Set up
$(function() {
  $.material.init();
  $.get("config.json").then(
    function(config) {
      var router = new Backbone.Router;
      var root_view = new Gohan.AppView({
        router: router,
        config: config,
        viewClass: {"schema": {
          table: Gohan.SchemaView
        }}
      });
      $('body').append(root_view.render().el);
      Backbone.history.start();
    }).fail(function() {
    $('body').append('Failed to load config.json');
  });
});

Gohan.SchemaModel = Backbone.Model.extend({
  collections: [],
  apiEndpoint: function(){
    return this.apiEndpointBase() + this.get('url');
  },
  apiEndpointBase: function() {
    return this.collection.base_url;
  },
  detailPath: function(id){
    return this.get('url') + '/' + id;
  },
  url: function() {
    if(!this.hasParent()){
      return this.get('url');
    }
    var parent_schema = this.parent();
    return parent_schema.url() + '/:' + parent_schema.get('singular') + '/' + this.get('plural');
  },
  parent: function(){
    var parent_id = this.get('parent');
    return this.collection.get(parent_id);
  },
  parentProperty: function(){
    return this.get('parent') + "_id";
  },
  hasParent: function(){
    return !_.isUndefined(this.get('parent')) && this.get('parent') != '';
  },
  makeModel: function(base_url) {
    var self = this;
    if(_.isUndefined(base_url)){
      base_url = self.apiEndpoint();
    }
    var userModel = self.collection.userModel;
    return Backbone.Model.extend({
      schema: self,
      initialize: function() {
        this.base_url = base_url;
        this.url = this.base_url;
      },
      isNew: function() {
        return this.get("_is_new");
      },
      parse: function(resp) {
        if(_.isUndefined(resp["id"])){
           return resp[self.get('singular')];
        }
        return resp;
      },
      sync: function(method, model, options){
        if (!this.isNew()) {
            this.url = this.base_url + "/" + this.id;
        }
        if(method === "patch"){
          method = "update";
        }
        if(_.isUndefined(options)){
          options = {};
        }
        options["headers"] = {
          'X-Auth-Token': userModel.authToken(),
          'Content-Type':'application/json'
        };
        this.unset("_is_new");
        var data = {};
        var modelJSON= {}
        var schemaForAction = self.filterByAction(method)
        console.log(schemaForAction)
        _.each(schemaForAction.properties, function(value, key){
          modelJSON[key] = model.get(key)
        })
        console.log(modelJSON)
        data[this.schema.get('singular')] = modelJSON
        options.data = JSON.stringify(data);
        Backbone.sync(method, model, options);
      },
      parent_id: function(){
        if(this.schema.hasParent()){
          var parent_property = this.schema.parentProperty();
          return this.get(parent_property);
        }
        return undefined;
      },
      fragment: function() {
        var path = this.schema.detailPath(this.id);
        return path.substr(1);
      },
      getAncestors: function(callback, ancestors) {
        var self = this;
        if(_.isUndefined(ancestors)){
          ancestors = [];
        }
        if(!self.schema.hasParent()){
          callback(ancestors);
          return
        }
        var parent_schema = self.schema.parent();
        var parent_model_class = parent_schema.makeModel();
        if(_.isUndefined(self.parent_id())){
          return
        }
        var parent_model = new parent_model_class({"id": self.parent_id()});
        parent_model.fetch({
          success: function(){
            ancestors.push(parent_model);
            parent_model.getAncestors(callback, ancestors);
          }});
      }
    });
  },
  makeCollection: function(url) {
    var self = this;
    if(_.isUndefined(url)){
      url = self.apiEndpoint();
    }
    if(self.collections[url]){
      return self.collections[url];
    }
    var model = self.makeModel(url);
    var userModel = self.collection.userModel;
    var collection_class = Backbone.Collection.extend({
      url: url,
      model: model,
      schema: self,
      parse: function(resp) {
        return resp[self.get('plural')];
      },
      unsetAuthData: function() {
        this.userModel.unsetAuthData();
      },
      sync: function(method, collection, options){
        if(_.isUndefined(options)){
          options = {};
        }
        options["headers"] = {
          'X-Auth-Token': userModel.authToken(),
          'Content-Type':'application/json'
        };
        Backbone.sync(method, collection, options);
      }
    });
    var collection = new collection_class({});
    self.collections[url] = collection;
    return collection;
  },
  toLocalSchema: function(schema) {
    //convert dict in schema to array for form generation
    //In json schema, we can't type dict element, so gohan
    //extend json schema using items property for object.
    //If object type has items property, items is considered to
    //schema for object of dict.
    //We will transform schema here for jsonform lib.
    var self = this;
    if (_.isArray(schema.type)) {
      schema.type = schema.type[0];
    }
    if (!_.isUndefined(schema.relation)) {
      var enum_values = [];
      var options = {};
      var headers = {};
      headers['X-Auth-Token'] = self.collection.userModel.authToken();
      var relatedSchema = self.collection.get(schema.relation);
      $.ajax({
        url: relatedSchema.apiEndpoint(),
        headers: headers,
        //need revisit
        async: false,
      }).then(function(data) {
        _.each(data, function(values, key) {
          _.each(values, function(value) {
            enum_values.push(value.id);
            options[value.id] = value.name;
          });
        });
      });
      schema.enum = enum_values;
      schema.options = options;
      return schema;
    }
    var result = $.extend(true, {}, schema);
    if (schema.type == "array") {
      result.items = self.toLocalSchema(result.items);
      return result;
    };
    if (schema.type != "object") {
      return schema;
    }
    if (!_.isUndefined(schema.properties)) {
      $.each(schema.properties, function(key, property) {
        result.properties[key] = self.toLocalSchema(property);
      });
    } else if (!_.isUndefined(schema.items)) {
      result.type = "array";
      var items = self.toLocalSchema(result.items);
      if (_.isUndefined(items.title)) {
        items.title = "value";
      }
      result.items = {
        "type": "object",
        "required": schema.required,
        "properties": {
          "id": {
            "title": "key",
            "type": "string"
          },
          "value": items
        }
      };
    } else {
      result.type = "string";
      result.format = "yaml";
    }
    return result;
  },
  defaultValue: function(schema) {
    var self = this;
    if (schema.type == "object") {
      if (_.isUndefined(schema.default)) {
        var result = {};
        _.each(schema.properties, function(property, key) {
          result[key] = self.defaultValue(property);
        });
        return result;
      }
    }
    return schema.default;
  },
  toLocal: function(data) {
    var default_value = {};
    var schema = this.get('schema');
    data = _.extend(this.defaultValue(schema), data);
    return this.toLocalData(schema, data);
  },
  toLocalData: function(schema, data) {
    var self = this;
    if (schema.type != "object") {
      return data;
    }
    if (_.isUndefined(data)) {
      return undefined;
    }

    if (schema.format == "jsonschema") {
      return jsyaml.safeDump(data);
    } else if (!_.isUndefined(schema.properties)) {
      $.each(schema.properties, function(key, property) {
        data[key] = self.toLocalData(property, data[key]);
      });
    } else if (!_.isUndefined(schema.items)) {
      var result = [];
      if (_.isUndefined(schema.items.propertiesOrder)) {
        _.each(data, function(value, key) {
          result.push({
            "id": key,
            "value": self.toLocalData(schema.items, value)
          });
        });
      } else {
        _.each(schema.items.propertiesOrder, function(key) {
          var value = data[key];
          result.push({
            "id": key,
            "value": self.toLocalData(schema.items, value)
          });
        });
      }
      return result;
    } else {
      return jsyaml.safeDump(data);
    }
    return data;
  },
  toServer: function(data) {
    return this.toServerData(this.get('schema'), data);
  },
  toServerData: function(schema, data) {
    var self = this;
    if (schema.type != "object") {
      return data;
    }
    if (_.isUndefined(data)) {
      return undefined;
    }
    if (!_.isUndefined(schema.properties)) {
      $.each(schema.properties, function(key, property) {
        data[key] = self.toServerData(property, data[key]);
      });
    } else if (!_.isUndefined(schema.items)) {
      var result = {};
      _.each(data, function(d) {
        result[d.id] = self.toServerData(schema.items, d.value);
      });
      return result;
    } else {
      return jsyaml.safeLoad(data);
    }
    return data;
  },
  filterByAction: function(action, parent_property) {
    var result = {};
    var schema = this.toJSON();
    var local_schema = this.toLocalSchema(schema.schema);
    $.each(local_schema.properties, function(key, property) {
      if (key == "id" && property.format == "uuid") {
        return;
      }
      if (key == parent_property) {
        return;
      }
      if (_.isNull(property.permission) || _.isUndefined(property.permission)) {
        return;
      }
      var view = property['view']
      if(view){
        if(view.indexOf(action) < 0){
          return
        }
      }
      if (property.permission.indexOf(action) >= 0) {
        result[key] = property;
      }
    });
    var required = _.filter(schema.schema.required, function(property) {
      return result.hasOwnProperty(property);
    });
    return {
      "type": "object",
      "properties": result,
      "propertiesOrder": schema.schema.propertiesOrder,
      "required": required
    };
  },
  children: function() {
    var self = this;
    return this.collection.filter(function (schema) {
      return schema.get('parent') === self.id;
    });
  }
});

Gohan.SchemaCollection = Backbone.Collection.extend({
  model: Gohan.SchemaModel,
  initialize: function(options) {
    this.base_url = options.base_url;
    this.url = options.url;
    this.userModel = options.userModel;
  },
  parse: function(resp) {
    return resp["schemas"];
  },
  unsetAuthData: function() {
    this.userModel.unsetAuthData();
  },
  sync: function(method, collection, options){
    if(_.isUndefined(options)){
      options = {};
    }
    options["headers"] = {
      'X-Auth-Token': this.userModel.authToken(),
      'Content-Type':'application/json'
    };
    Backbone.sync(method, collection, options);
  }
});

Gohan.UserModel = Backbone.Model.extend({
  defaults: {
    'auth_data': undefined
  },
  initialize: function(options) {
    this.url = options.url;
  },
  parse: function(data) {
    this.setAuthData(data);
  },
  sync: function(method, model, options){
    if(_.isUndefined(options)){
      options = {};
    }
    options["headers"] = {
      'Content-Type':'application/json'
    };
    Backbone.sync(method, model, options);
  },
  saveAuth: function(id, password, tenant) {
    var auth_data = {
      'auth': {
        'passwordCredentials': {
          'username': id,
          'password': password
        },
        'tenantName': tenant
      }
    };
    this.save(auth_data, {
       wait: true,
       data: JSON.stringify(auth_data),
       error: Gohan.error
    });
  },
  setAuthData: function(data) {
    var MAX_COOKIE_LENGTH = 2000;
    if (!_.isUndefined(data)) {
      var token = data.access.token.id;
      var tenant_name = data.access.token.tenant.name;
      var user_name = data.access.user.name;
      $.cookie('tenant_name', tenant_name);
      $.cookie('user_name', user_name);
      $.cookie('auth_data1', token.slice(0, MAX_COOKIE_LENGTH));
      $.cookie('auth_data2', token.slice(MAX_COOKIE_LENGTH));
      this.set('auth_data', data);
    } else {
      $.removeCookie('auth_data1');
      $.removeCookie('auth_data2');
    }
  },
  authToken: function() {
    if(_.isUndefined($.cookie('auth_data1'))){
      return false;
    }
    return $.cookie('auth_data1') + $.cookie('auth_data2');
  },
  tenantName: function() {
    return $.cookie('tenant_name');
  },
  userName: function() {
    return $.cookie('user_name');
  },
  unsetAuthData: function() {
    this.setAuthData(undefined);
  }
});

Gohan.DetailView = Backbone.View.extend({
  tagName: 'div',
  className: 'detailview',
  initialize: function(options) {
    this.app = options.app;
    this.schema = options.schema;
    this.childview = options.childview;
    this.model = options.model;
    this.fragment = options.fragment;
    this.listenTo(this.model, 'sync', this.render);
    this.model.fetch({
      error: Gohan.error
    });
  },
  renderProperty: function(data, key) {
    var content;
    var property = this.schema.get("schema").properties[key];
    var value = data[key];
    if (_.isUndefined(value)) {
      return "";
    }
    if (_.isUndefined(property)) {
      return "";
    }
    var related_object = data[property.relation_property];
    if (!_.isUndefined(related_object)) {
        if (!_.isUndefined(related_object.name)) {
          return related_object.name
        }
    }
    if (property.type == "object") {
      content = $("<pre style='width:500px;'></pre>").text(jsyaml.safeDump(value)).html();
      return "<pre>" + _.escape(content) + "</pre>";
    }
    if (property.type == "array") {
      return "<pre>" + jsyaml.safeDump(value) + "</pre>";
    }
    return _.escape(value);
  },
  // View methods
  // ------------
  render: function() {
    var self = this;
    var data = self.model.toJSON();
    var result = _.extend({}, data);
    _.each(data, function(value, key) {
      result[key] = self.renderProperty(data, key);
    });
    var children = self.schema.children().map(function (child){
      var fragment = self.fragment + '/' + child.get('plural');
      return {
        id: child.id,
        title: child.get('title'),
        href: fragment,
      };
    });
    self.$el.html(JST['detail.html']({
      'data': result,
      'schema': self.schema.toJSON(),
      'children': children
    }));
    var make_breadcrumb = function (ancestors){
      ancestors.unshift(self.model);
      var fragment = self.fragment;
      var parents = ancestors.map(function(ancestor){
          var model_fragment = fragment;
          fragment = fragment.replace(/\/[^\/]+$/, "");
          var schema_fragment = fragment;
          fragment = fragment.replace(/\/[^\/]+$/, "");
          if(ancestor.schema.hasParent() && self.childview){
            var schema_fragment = fragment;
          }
          return {
            title: ancestor.get("name"),
            schema_title: ancestor.schema.get("title"),
            fragment: model_fragment,
            schema_fragment: schema_fragment
          }
      });
      parents.reverse();
      $('#bread_crumb', self.$el).html(JST['breadcrumb.html']({
        parents: parents
      }));
    };
    if(self.childview){
      self.model.getAncestors(make_breadcrumb);
    }else{
      make_breadcrumb([]);
    }
    self.schema.children().forEach(function (child){
      var fragment = self.fragment + '/' + child.get('plural');
      var endpoint = self.schema.apiEndpointBase() + '/' + fragment;
      var collection = child.makeCollection(endpoint);
      var tableView = new Gohan.TableView({
        schema: child,
        collection: collection,
        childview: true,
        fragment: fragment,
        app: this.app,
      });
      $("div#" + child.id + "_table", self.$el).html(tableView.render().el);
      return {
        title: child.get('title'),
        href: fragment,
        element: tableView.render().el
      };
    });

    this.$("button[data-toggle=hover]").popover();
    return this;
  }
});

Gohan.HeaderView = Backbone.View.extend({
  tagName: 'div',
  events: {
    'click #logout': 'logout',
  },
  className: 'container-fluid',
  initialize: function(options) {
    this.config = options.config;
    this.listenTo(this.model, 'change:auth_data', this.render);
  },
  logout: function() {
    console.log("click!");
    this.model.unsetAuthData();
    window.location.reload();
  },
  render: function(e) {
    this.$el.html(JST['header.html']({
      config: this.config,
      username: this.model.userName(),
      auth_token: this.model.authToken(),
      tenant_name: this.model.tenantName()
    }));
    return this;
  },
  noaction: function(e) {
    e.preventDefault();
  }
});

Gohan.LoginView = Backbone.View.extend({
  tagName: 'div',
  events: {
    'click input.btn': 'login'
  },
  initialize: function(options) {
    this.model = options.model;
    this.listenTo(this.model, 'change:auth_data', this.reload);
  },
  reload: function(e) {
    Backbone.history.loadUrl(Backbone.history.fragment);
  },
  render: function() {
    this.$el.html(JST['login.html']({
      tenant_name: $.cookie('tenant_name')
    }));
    return this;
  },
  login: function(e) {
    e.preventDefault();
    var id = this.$('#id').val();
    var password = this.$('#password').val();
    var tenant = this.$('#tenant').val();
    $("#alerts").empty();
    this.model.saveAuth(id, password, tenant);
  }
});

Gohan.SidebaritemView = Backbone.View.extend({
  tagName: 'li',
  events: {
    'click a': function(e) {
      e.preventDefault();
      Backbone.history.navigate(this.model.get('path'), true);
    }
  },
  initialize: function() {
    this.listenTo(this.model, 'change', this.render);
    this.listenTo(this.model, 'remove', this.remove);
    this.$el.addClass('withripple');
    this.$el.addClass(this.model.get('class'));
  },
  // View methods
  // ------------
  render: function() {
    this.$el.html(JST['sideview_item.html']({
      source: this.model.toJSON()
    }));
    return this;
  }
});

Gohan.SidebarView = Backbone.View.extend({
  tagName: 'ul',
  className: 'document-row',
  initialize: function(options) {
    this.schemas = options.schemas;
    this.listenTo(this.collection, 'add', this.append);
  },
  // View methods
  // ------------
  render: function() {
    this.collection.each(function(model) {
      this.append(model);
    }, this);
    return this;
  },
  append: function(model) {
    var item_view = (new Gohan.SidebaritemView({
      model: model
    })).render();
    var index = this.collection.indexOf(model);
    if (index === 0) {
      this.$el.prepend(item_view.el);
    } else {
      item_view.$el.insertAfter(this.$el.children()[index - 1]);
    }
  },
  select: function(model) {
    this.$('.active').removeClass('active');
    if (model) {
      var index = this.collection.indexOf(model);
      $(this.$el.children()[index]).addClass('active');
    }
  }
});

Gohan.TableView = Backbone.View.extend({
  tagName: 'div',
  className: 'tableview',
  events: {
    "click .gohan_create": "createModel",
    "click .gohan_delete": "deleteModel",
    "click .gohan_update": "updateModel"
  },
  initialize: function(options) {
    this.app = options.app;
    this.schema = options.schema;
    this.fragment = options.fragment;
    this.childview = options.childview;
    if( this.childview ) {
      this.parent_property = this.schema.get('parent') + "_id";
    }
    this.listenTo(this.collection, 'update', this.render);
    this.collection.fetch({
       error: Gohan.error
    });
  },
  dialogForm: function(action, form_title, data, onsubmit) {
    var self = this;
    var form = $("<form></form>", self.$el);
    form.jsonForm({
      schema: self.schema.filterByAction(action, self.parent_property),
      value: data,
      form: ['*'],
      onSubmit: function(errors, values) {
        if (errors) {
          self.dialog.getButton('submit').stopSpin();
          self.dialog.enableButtons(true);
          self.dialog.setClosable(true);
          return
        }
        onsubmit(values);
      }
    });
    form.prepend("<div id='alerts_form'></div>");
    self.dialog = BootstrapDialog.show({
      size: BootstrapDialog.SIZE_WIDE,
      type: BootstrapDialog.TYPE_DEFAULT,
      title: form_title,
      closeByKeyboard: false,
      message: form,
      spinicon: 'glyphicon glyphicon-refresh',
      onshown: function() {
        $('.modal-body').css({
          "max-height": $(window).height() - 200 + 'px'
        });
      },
      buttons: [{
        id: 'submit',
        label: 'Submit',
        cssClass: 'btn-primary btn-raised btn-material-blue-600',
        action: function(dialog) {
          self.dialog.enableButtons(false);
          self.dialog.setClosable(false);
          this.spin();
          form.submit();
        }
      }]
    });
  },
  toLocal: function(data) {
    return this.schema.toLocal(data);
  },
  toServer: function(data) {
    return this.schema.toServer(data);
  },
  createModel: function (){
    var self = this;
    var data = self.toLocal({});
    var form_title = '<h4>Create ' + self.schema.get("title") + '</h4>';
    var action = "create";
    var onsubmit = function (values) {
      values = self.toServer(values);
      values["_is_new"] = true;
      self.collection.create(values, {
        wait: true,
        success: function() {
          self.dialog.close();
          self.collection.fetch({
             success: function(){
               self.render()
             },
             error: Gohan.error
          });
        },
        error: function(collection, response){
          Gohan.error(collection, response);
          self.dialog.getButton('submit').stopSpin();
          self.dialog.enableButtons(true);
          self.dialog.setClosable(true);
      }});
    };
    self.dialogForm(action, form_title, data, onsubmit);
  },
  updateModel: function(evt) {
    var self = this;
    var target = $(evt.target);
    var id = target.data('id');
    var model = this.collection.get(id);
    var data = self.toLocal(model.toJSON());
    var action = 'update';
    var form_title = '<h4>Update ' + self.schema.get("title") + '</h4>';
    var onsubmit = function(values){
      var values = self.toServer(values);
      model.save(values, {
        patch: true,
        wait: true,
        success: function(){
          self.collection.trigger("update");
          self.dialog.close();
          self.collection.fetch({
             success: function(){
               self.render()
             },
             error: Gohan.error
          });
        },
        error: function(collection, response){
          Gohan.error(collection, response);
          self.dialog.getButton('submit').stopSpin();
          self.dialog.enableButtons(true);
          self.dialog.setClosable(true);
        }
      });
    };
    self.dialogForm(action, form_title, data, onsubmit);
  },
  deleteModel: function (evt){
    var target = $(evt.target);
    var id = target.data("id");
    var model = this.collection.get(id);
    model.destroy({"wait": "true", "error": Gohan.error});
  },
  renderProperty: function(data, key) {
    var content;
    var property = this.schema.get("schema").properties[key];
    var value = data[key];
    if (_.isUndefined(property)) {
      return "";
    }
    if (_.isUndefined(value)) {
      return "";
    }
    var related_object = data[property.relation_property];
    if (!_.isUndefined(related_object)) {
        if (!_.isUndefined(related_object.name)) {
          return related_object.name
        }
    }
    if (property.type == "object") {
      content = $("<pre style='width:500px;'></pre>").text(
        "<pre>" + jsyaml.safeDump(value) + "</pre>").html();
      content = content.replace("'", "&#39;");
      return JST['data_popup.html']({
        content: content
      });
    }
    if (property.type == "array") {
      return "<pre>" + jsyaml.safeDump(value) + "</pre>";
    }
    var title = property.title.toLowerCase();
    if (title == "name" || title == "title")
    {
      return "<a href='#" + this.fragment + "/" + data.id + "'>" + _.escape(value) + "</a>";
    }
    return value;
  },
  render: function() {
    var self = this;
    var list = this.collection.map(function(model) {
      var data = model.toJSON();
      var result = _.extend({}, data);
      _.each(data, function(value, key) {
        result[key] = self.renderProperty(data, key);
      });
      return result;
    });
    this.$el.html(JST['table.html']({
      'data': list,
      'schema': this.schema.toJSON(),
      'parent_property': this.parent_property,
    }));
    this.$("button[data-toggle=hover]").popover();
    return this;
  }
});

Gohan.SchemaView = Gohan.TableView.extend({
  toLocal: function(data){
    return data;
  },
  toServer: function(data){
    return data;
  },
  dialogForm: function(action, form_title, data, onsubmit) {
    var self = this;
    var form = $("<form></form>", self.$el);
    var schema = self.schema.filterByAction(action, self.parent_property);
    schema.propertiesOrder = ["id",
                              "singular",
                              "plural",
                              "title",
                              "description",
                              "parent",
                              "namespace",
                              "prefix"]
    schema.required = []

    var propertyColumns = [
        {
          id: "title",
          type: "string",
        },
        {
          id: "type",
          type: "string",
          enum: [
            "string",
            "boolean",
            "integer",
            "number",
            "array",
            "object",
          ]
        },
        {
          id: "description",
          type: "string",
        },
        {
          id: "required",
          type: "checkbox",
        }
    ];
    var properties = [];
    if(_.isUndefined(data.schema)){
        data.schema = {
            properties: {
                id: {
                    title: "ID",
                    type: "string",
                    description: "ID",
                    permission: ["create"],
                    view: ["detail"]
                },
                name: {
                    title: "Name",
                    type: "string",
                    description: "Name",
                    permission: ["create", "update"],
                },
                description: {
                    title: "Description",
                    type: "string",
                    description: "Description",
                    permission: ["create", "update"],
                },
                tenant_id: {
                    title: "Tenant ID",
                    type: "string",
                    description: "Tenant ID",
                    permission: ["create"],
                    view: ["detail"]
                }
            },
            propertiesOrder: [
                "id",
                "name",
                "description",
                "tenant_id"
            ]
        }
    }
    form.jsonForm({
      schema: schema,
      value: data,
      form: ['*'],
      onSubmit: function(errors, values) {
        var propertiesOrder = [];
        var required = [];
        var properties = {};
        $("#properties_table tbody tr").each(function(){
          var property = $(this).data("property");
          var id = property.id;
          if(_.isUndefined(id)){
            return;
          }
          if(properties[id]){
            return;
          }
          propertiesOrder.push(property.id);
          if(property.required){
            required.push(id);
          }
          delete property.id;
          delete property.required;
          properties[id] = property;
        });
        var schema = {
          type: "object",
          propertiesOrder: propertiesOrder,
          required: required,
          properties: properties
        };
        values.schema = schema;
        console.log(values)
        if (errors) {
          self.dialog.getButton('submit').stopSpin();
          self.dialog.enableButtons(true);
          self.dialog.setClosable(true);
          return
        }
        onsubmit(values);
      }
    });
    form.append($(JST["schema_form.html"]({
      JST: JST,
      propertyColumns: propertyColumns,
    })));
    var data_schema = data.schema || {}
    _.each(data_schema.propertiesOrder, function(id){
      var property = _.extend({}, data_schema.properties[id]);
      if(_.isUndefined(property)){
          return
      }
      var required = false;
      if(data_schema.required && data_schema.required.indexOf(id) >= 0){
        required = true;
      }
      property.id = id;
      property.required = required;
      properties.push(property);
    });
    var defaultProperty = {
      type: "string",
      permission: ["create", "update"]
    };
    properties.push(_.extend({}, defaultProperty));

    var addNewRow = function(property){
      var newRow = $(JST["property_form.html"]({
        propertyColumns: propertyColumns,
        property: property
      }));
      $(".id_form", newRow).change(ensureNewRow);
      $("#properties_table tbody", form).append(newRow);
      $("#id", newRow).change(function(){
        property["id"] = $(this).val();
      });
      newRow.data("property", property);
      _.each(propertyColumns, function(column){
        $("#" + column.id, newRow).change(function(){
          if(column.type == "checkbox") {
            property[column.id] = $(this).is(':checked');
          }else{
            property[column.id] = $(this).val();
          }
          console.log(property);
        });
      });
      $("button#detail", newRow).click(function(){
        var detailPane = $("<div style='width:500px;height:200px;'></div>")
        var ace = window.ace;
        var editor = ace.edit(detailPane.get(0));
        editor.getSession().setNewLineMode('unix');
        editor.setTheme("ace/theme/monokai");
        editor.getSession().setMode("ace/mode/yaml");
        editor.getSession().setTabSize(2);
        editor.$blockScrolling = "Infinity";
        var yaml = jsyaml.safeDump(property)
        editor.getSession().setValue(yaml);
        var dialog = BootstrapDialog.show({
          title: "Property Detail",
          closeByKeyboard: false,
          message: detailPane,
          spinicon: 'glyphicon glyphicon-refresh',
          onshown: function() {
            $('.modal-body').css({
              "max-height": $(window).height() - 200 + 'px'
            });
          },
          buttons: [{
            id: 'submit',
            label: 'Submit',
            cssClass: 'btn-primary btn-raised btn-material-blue-600',
            action: function(dialog) {
              var yaml = editor.getSession().getValue()
              var data = jsyaml.safeLoad(yaml);
              _.each(property, function(value, key){
                delete property[key];
              });
              _.each(data, function(value, key){
                property[key] = value;
              });
              dialog.close();
            }
          }]
        });
      });
    };
    var ensureNewRow = function(){
      var requireRow = true;
      $(".id_form", form).each(function(){
        if($(this).val() == ""){
          requireRow = false;
        }
      });
      if(requireRow){
        addNewRow(_.extend({}, defaultProperty));
      }
    };
    _.each(properties, function(property){
      addNewRow(property);
    });

    $("#properties_table tbody", form).sortable();
    form.prepend("<div id='alerts_form'></div>");
    self.dialog = BootstrapDialog.show({
      size: BootstrapDialog.SIZE_WIDE,
      type: BootstrapDialog.TYPE_DEFAULT,
      title: form_title,
      closeByKeyboard: false,
      message: form,
      spinicon: 'glyphicon glyphicon-refresh',
      onshown: function() {
        $('.modal-body').css({
          "max-height": $(window).height() - 200 + 'px'
        });
      },
      buttons: [{
        id: 'submit',
        label: 'Submit',
        cssClass: 'btn-primary btn-raised btn-material-blue-600',
        action: function(dialog) {
          self.dialog.enableButtons(false);
          self.dialog.setClosable(false);
          this.spin();
          form.submit();
        }
      }]
    });
  },

})
