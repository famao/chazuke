Gohan.UserModel = Backbone.Model.extend({
  defaults: {
    'auth_data': undefined
  },
  initialize: function(options) {
    this.url = options.url;
    this.version = options.version;
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
  saveAuthV2: function(id, password, tenant, domain) {
    var auth_data = {
      'auth': {
        'passwordCredentials': {
          'username': id,
          'password': password
        },
        'tenantName': tenant
      }
    };
    if (domain != '') {
        auth_data.auth['domainName'] =  domain;
    }
    this.save(auth_data, {
       wait: true,
       data: JSON.stringify(auth_data),
       error: Gohan.error
    });
  },
  saveAuthV3: function(id, password, tenant, domain) {
    var auth_data = {
       'auth' : {
         'identity' : {
            'methods' : ['password'],
            "password" : {
               "user" : id,
               "domain" : { "name" : domain },
               "password" : password
            }
         }
       },
       'scope' : {
          'project' :  {
            'name' : tenant,
            'domain' : { "name" : domain }
          }
       }
    };
    this.save(auth_data, {
       wait: true,
       data: JSON.stringify(auth_data),
       error: Gohan.error
    });
  },
  saveAuth: function(id, password, tenant, domain) {
    if (this.version == "v3") {
       this.saveAuthV3(id, password, tenant, domain);
    } else {
       this.saveAuthV2(id, password, tenant, domain);
    }
  },
  setAuthData: function(data) {
    var MAX_COOKIE_LENGTH = 2000;
    if (!_.isUndefined(data)) {
      var token = data.access.token.id;
      var tenant_name = data.access.token.tenant.name;
      var user_name = data.access.user.name;
      var domain_name = data.access.token.domain.name;
      $.cookie('tenant_name', tenant_name);
      $.cookie('domain_name', domain_name);
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
  domainName: function() {
    return $.cookie('domain_name');
  },
  unsetAuthData: function() {
    this.setAuthData(undefined);
  }
});
