sap.ui.define([
  "sap/m/MessageBox"
], function(MessageBox) {
  "use strict";

  return {
    /**
     * Check authorization for specific activity
     * @param {string} activity - Activity code (01=Create, 02=Change, 03=Display)
     * @param {object} oController - Controller instance to get the model from
     * @returns {Promise} - Authorization check result
     */
    checkAuthorization: function(activity, oController) {
      return new Promise((resolve, reject) => {
        try {
          console.log("Authorization check for activity:", activity);
          
          // Get model from controller or fallback to component
          var oModel;
          if (oController && typeof oController.getModel === "function") {
            try {
              oModel = oController.getModel();
            } catch (e) {
              console.warn("Could not get model from controller:", e);
            }
          }
          
          if (!oModel && oController && typeof oController.getOwnerComponent === "function") {
            try {
              var oComponent = oController.getOwnerComponent();
              if (oComponent && typeof oComponent.getModel === "function") {
                oModel = oComponent.getModel();
              }
            } catch (e) {
              console.warn("Could not get model from component:", e);
            }
          }
          
          if (!oModel) {
            try {
              // Fallback to core model
              oModel = sap.ui.getCore().getModel();
            } catch (e) {
              console.warn("Could not get core model:", e);
            }
          }

          if (!oModel) {
            console.error("No model found for authorization check");
            // Reject if no model is available - this should not happen in production
            resolve(false);
            return;
          }
          
          var sPath = "/AuthorizationCheck";
          var oData = {
            Activity: activity
          };

          oModel.callFunction(sPath, {
            method: "POST",
            urlParameters: oData,
            success: function(oResult) {
              console.log("Authorization check result:", oResult);
              if (oResult.AuthorizationCheck && oResult.AuthorizationCheck.Authorized === "X") {
                resolve(true);
              } else {
                resolve(false);
              }
            },
            error: function(oError) {
              console.error("Authorization check failed:", oError);
              // Reject authorization if service call fails
              resolve(false);
            }
          });
        } catch (error) {
          console.error("Error in authorization check:", error);
          // Reject authorization if there's an error
          resolve(false);
        }
      });
    },

    /**
     * Check if user can create reports
     * @param {object} oController - Controller instance
     */
    canCreate: function(oController) {
      return this.checkAuthorization("01", oController);
    },

    /**
     * Check if user can change reports
     * @param {object} oController - Controller instance
     */
    canChange: function(oController) {
      return this.checkAuthorization("02", oController);
    },

    /**
     * Check if user can display reports
     * @param {object} oController - Controller instance
     */
    canDisplay: function(oController) {
      return this.checkAuthorization("03", oController);
    },

    /**
     * Redirect to home page without showing error message
     * @param {object} oController - Controller instance for routing
     */
    redirectToHome: function(oController) {
      if (oController && oController.getOwnerComponent) {
        try {
          var oRouter = oController.getOwnerComponent().getRouter();
          if (oRouter) {
            // Navigate to the home route (selection screen)
            oRouter.navTo("home");
            return;
          }
        } catch (e) {
          console.error("Could not navigate to front page:", e);
        }
      }
      
      // Fallback: reload the page to go to home
      window.location.href = window.location.origin + window.location.pathname;
    },

    /**
     * Show authorization error message and redirect to front page
     * @param {string} activity - Activity code for error message
     * @param {object} oController - Controller instance for routing
     */
    showAuthorizationErrorAndRedirect: function(activity, oController) {
      var sMessage = "";
      switch(activity) {
        case "01":
          sMessage = "You are not authorized to create project cost reports. You will be redirected to the selection page.";
          break;
        case "02":
          sMessage = "You are not authorized to change project cost reports. You will be redirected to the selection page.";
          break;
        case "03":
          sMessage = "You are not authorized to display project cost reports. You will be redirected to the selection page.";
          break;
        default:
          sMessage = "You are not authorized to perform this action. You will be redirected to the selection page.";
      }
      
      MessageBox.error(sMessage, {
        title: "Authorization Error",
        onClose: function() {
          // Redirect to front page/selection screen
          if (oController && oController.getOwnerComponent) {
            try {
              var oRouter = oController.getOwnerComponent().getRouter();
              if (oRouter) {
                // Navigate to the home route (selection screen)
                oRouter.navTo("home");
              }
            } catch (e) {
              console.error("Could not navigate to front page:", e);
              // Fallback: reload the page to go to home
              window.location.href = window.location.origin + window.location.pathname;
            }
          } else {
            // Fallback: reload the page to go to home
            window.location.href = window.location.origin + window.location.pathname;
          }
        }
      });
    },

    /**
     * Show authorization error message
     */
    showAuthorizationError: function(activity) {
      var sMessage = "";
      switch(activity) {
        case "01":
          sMessage = "You are not authorized to create project cost reports.";
          break;
        case "02":
          sMessage = "You are not authorized to change project cost reports.";
          break;
        case "03":
          sMessage = "You are not authorized to display project cost reports.";
          break;
        default:
          sMessage = "You are not authorized to perform this action.";
      }
      
      MessageBox.error(sMessage, {
        title: "Authorization Error"
      });
    }
  };
});
