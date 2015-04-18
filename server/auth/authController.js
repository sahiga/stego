// Auth Controller
// ---------------
//
// The Auth controller handles requests passed from the User router.

var apiHandler = require('../APIs/apiHandler.js');
var userCtrl = require('../users/userController.js');

var auth = {

  // Save a new user in our database
  createNewUserAccount: function(req, res){
    console.log('creating a new user, allegedly');
    var userAccount = req.query.accountCodes;
    userAccount.time = req.query.timeframe;

    // Exchange provider codes for provider tokens
    apiHandler.getTokens(userAccount)

      // Get Github User information
      .then(function() {
        return apiHandler.getGithubUser(userAccount);
      })

      // Check if this user is in our database, if so, reply with user.  Otherwise, continue to create a new user
      .then(function(userAccount) {
        console.log(userAccount);
        return userCtrl.checkForUser(res, userAccount)
          .then(function(foundUser) {
            if( !foundUser ) {
              console.log('are we at least acknowledging that we didn\'t find a user?');
              return continueCreation(userAccount);
            }
          });
      });


    var continueCreation = function() {
      console.log('are we making the hop to the other set of promises?');

      // Get github api information
      return apiHandler.getGithubData(userAccount)

      // Get user's Fitness Tracker's step-count
      .then(function() {
        console.log('are we getting more data?');
        return apiHandler.getFitnessData(userAccount);
      })

      // Save user account to database
      .then(function(){
        // res.json(userAccount);
        userCtrl.saveUser(res, userAccount);
      })
      // Catch any errors
      .fail(function(error) {
        console.error(error);
        res.send('Error creating new user', error);
      });
    };
  },

  loginUser: function(req, res) {
    var userAccount = req.query.accountCodes;

    // Exchange Github code for token
    apiHandler.getTokens(userAccount)

    .then(function() {
      return apiHandler.getGithubUser(userAccount);
    })
    .then(function() {
      userCtrl.checkForUser(userAccount, res)
        .then(function(foundUser) {
          if( !foundUser ) {
            res.send(404, 'No account found for this login');
          }
        });
    });
  }
};

module.exports = auth;
