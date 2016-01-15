Gohan.LoginView = Backbone.View.extend({
  tagName: 'div',
  events: {
    'click input.btn': 'login'
  },
  initialize: function(options) {
    this.model = options.model;
    this.config = options.config;
    this.listenTo(this.model, 'change:auth_data', this.reload);
  },
  reload: function(e) {
    Backbone.history.loadUrl(Backbone.history.fragment);
  },
  render: function() {
    var auth_version = this.config.auth_version;
    this.$el.html(JST['login.html']({
      tenant_name: $.cookie('tenant_name'),
      domain_name: $.cookie('domain_name'),
      auth_version: auth_version
    }));
    return this;
  },
  login: function(e) {
    e.preventDefault();
    var domain = '';
    var id = this.$('#id').val();
    var password = this.$('#password').val();
    var tenant = this.$('#tenant').val();
    domain = this.$('#domain').val();
    $("#alerts").empty();
    this.model.saveAuth(id, password, tenant, domain);
  }
});
