var webClientId =
    '519834680032-l7nvjmbred738hhs37p1n2706758l6dk.apps.googleusercontent.com';

Game.prototype.login = function() {
  var provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithRedirect(provider).then(function(result) {
    // This gives you a Google Access Token. You can use it to access the Google API.
    var token = result.credential.accessToken;
    // The signed-in user info.
    var user = result.user;
    // ...
  }).catch(function(error) {
    // Handle Errors here.
    var errorCode = error.code;
    var errorMessage = error.message;
    // The email of the user's account used.
    var email = error.email;
    // The firebase.auth.AuthCredential type that was used.
    var credential = error.credential;
    // ...
  });

  firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
      game.writeStatus('auth state user=' + user);
    } else {
      game.writeStatus('auth state: not logged in');
      // No user is signed in.
    }
  });
};
