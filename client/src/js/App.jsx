// This is the App Component, it hosts App-wide resources.

var React = require('react/addons');
var Landscape = require('./components/Landscape.jsx');
var keys = require('../../../server/config/secureAuth.js');
var $ = require('jquery');

var App = React.createClass({

  getInitialState: function() {

    return {
      // This property holds all user properties
      userInfo: {
        github: {
          name: null,
          username: null,
          reposUrl: null,
          repos: null,
          commitsByRepo: [],
          token: null
        },
        fitness: {
          username: null,
        }
      }
    };
  },
  
  // This is a faux-IIFE for auth so that auth can save the 'this' context.  A regular IIFE statement does not render the correct context.
  componentWillMount: function(){
    this.auth = this.auth();
  },

  // This property holds all Authentication logic.
  auth: function(){
    var app = this;

    var setAJAXParams = function(provider, usage, param) {
      var callLoc = provider + '-' + usage;
      console.log(callLoc);

      // This switch statement sets all properties necessary to make an AJAX call.  This allows us to create one AJAX call, and make different calls depending on provider.
      switch(callLoc) {
        case 'github-login':
          callParams = {
            url: 'https://github.com/login/oauth/authorize?client_id=' + keys.github.clientID,
            callback: function(res) {
              return res.split('?code=')[1];
            }
          };
          break;
        case 'github-getToken':
          callParams = {
            url: 'https://github.com/login/oauth/access_token',
            data: {
              code: param,
              client_id : keys.github.clientID,
              client_secret : keys.github.clientSecret
            },
            redirect_uri: 'https://eihfnhkmggidbojcjcgdjpjkhlbhealk.chromiumapp.org/githubToken',
            callback: function(res){
              var token = res.match(/(?:access_token=)[a-zA-Z0-9]+/g)[0].split('access_token=')[1];
              app.setState(React.addons.update(app.state, {
                userInfo: {github: {token: {$set: token} } }
              }));
              console.log('User info saved after login: ', app.state.userInfo);

                // We need to refactor this call to work with all APIs
              app.auth.makeRequest(provider, 'user'); 
            }
          };
          break;
        case 'github-user':
          callParams = {
            url: 'https://api.github.com/user',
            data: {access_token: app.state.userInfo.github.token},
            callback: function(user) {
                        app.setState(React.addons.update(app.state, {
                          userInfo: {github: {
                            name: {$set: user.name},
                            username: {$set: user.login},
                            reposUrl: {$set: user.repos_url}
                          } }
                        }));
                        console.log('Set github user: ', app.state);
                        app.auth.makeRequest(provider, 'repos');
                      }
          };
          break;
        case 'github-repos': 
          callParams = {
            url: app.state.userInfo.github.reposUrl,
            data: {access_token: app.state.userInfo.github.token},
            callback: function(repos){
              var reposList = [];
              
              repos.forEach(function(repo) {
                reposList.push(repo.name);
              });
              app.setState(React.addons.update(app.state, {
                userInfo: {github: {
                  repos: {$set: reposList}
                }}
              }));
              
              console.log('Saved user repos: ', reposList);
              console.log('Confirm via log User');

              app.state.userInfo.github.repos.forEach(function(repo) {
                app.auth.makeRequest('github', 'commits', repo);
              });
            }
          };
          break;
        case 'github-commits':
          callParams = {
            url: 'https://api.github.com/repos/' + app.state.userInfo.github.username + '/' + param + '/stats/contributors',
            data: {access_token: app.state.userInfo.github.token},
            callback: function(repoAuthors) {
              repoAuthors.forEach(function(authorInfo) {
                if( authorInfo.author.login === app.state.userInfo.github.name || authorInfo.author.login === app.state.userInfo.github.username ) {
                  app.setState(React.addons.update(app.state, {
                    userInfo: {github: {
                      commitsByRepo: {$push: [{repo: param, stats: authorInfo}]}
                    }}
                  }));
                }
              });
            }
          };
          break;

        case 'fitbit-login':
          callParams = {
            url: 'https://api.fitbit.com/oauth/request_token?oauth_consumer_key=' + keys.fitbit.consumerKey,
            data: {},
          };
          break;

        case 'jawbone':
          url = 'https://jawbone.com/auth/oauth2/auth?response_type=code&client_id=' + keys.jawbone.clientID;
          break;
      }
      console.log(callParams);
      return callParams;
    };

    return {
      login: function(provider) {
        var callParams = setAJAXParams(provider, 'login');
        console.log('Ajax call with params: ', callParams); 

        chrome.identity.launchWebAuthFlow({
          'url': callParams.url,
          'interactive': true
          },
          function(redirectUrl) {
            // This may be Github specific:
            var code = callParams.callback(redirectUrl);
            // callParams.data.code = code;
            console.log(redirectUrl);

            app.auth.postRequest(provider, 'getToken', code);

            // This function may be modularized out
            // $.ajax({
            //   type: 'POST',
            //   url: callParams.tokenUrl,
            //   data: callParams.data,
            //   redirect_uri: callParams.redirect_uri,
            //   success: function(res) {
            //     var token = res.match(/(?:access_token=)[a-zA-Z0-9]+/g)[0].split('access_token=')[1];
            //     app.setState(React.addons.update(app.state, {
            //       userInfo: {github: {token: {$set: token} } }
            //     }));
            //     console.log('User info saved after login: ', app.state.userInfo);

            //     // We need to refactor this call to work with all APIs
            //     app.auth.makeRequest(provider, 'user', callParams.callback); 
            //   },
            //   fail: function(err) {
            //     console.error('Failed to authenticate: ', err);
            //   }
            // });
        
          }
        );
      },
      
      // This function is modularized to make all GET requests for all APIs
      makeRequest: function(provider, usage, param) {
        var callParams = setAJAXParams(provider, usage, param);
        console.log(callParams);
        $.ajax({
          type: 'GET',
          url: callParams.url,
          data: callParams.data,
          success: function(res) {
            console.log('GET response: ', res);
            callParams.callback(res);
          },
          fail: function(err) {
            console.error('GET request failed: ', err);
          }
        });
      },

      postRequest: function(provider, usage, param) {
        var callParams = setAJAXParams(provider, usage, param);
        console.log(callParams);
        $.ajax({
          type: 'POST',
          url: callParams.url,
          data: callParams.data,
          redirect_uri: callParams.redirect_uri,
          success: function(res) {
            console.log('POST response: ', res);
            callParams.callback(res);
          },
          fail: function(err) {
            console.error('POST request failed: ', err);
          }
        });

      }
    };
  },

  render: function() {
    return (
      <div id="landscape-container">
        <Landscape userInfo={this.state.userInfo} auth={this.auth} />
      </div>
    );
  }

});

React.render(<App/>, document.body);
