sap.ui.define([
    "com/atg/ppm/postfinrevenue/controller/App.controller",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageToast",
    "sap/m/TablePersoController",
    "com/atg/ppm/postfinrevenue/controller/helper/TablePersonalizer",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel"
], (BaseController, MessageBox, BusyIndicator, MessageToast, TablePersoController, TablePersonalizer, Filter, FilterOperator, JSONModel) => {
    "use strict";

    return BaseController.extend("com.atg.ppm.postfinrevenue.controller.ProjectCostReport", {
        onInit: function() {
            // Reset the global flag when user comes to selection screen
            this._resetCreateReportFlag();
            
            var oForm = this.getView().byId("SmartForm");
            var oModel = this.getModel();
            
            oModel.metadataLoaded().then(() => {
                var oDefaultData = {
                    IsLineItemsRequested: "", // SAP format: "" for false, "X" for true
                    CutOffDate: new Date() // Set default cut off date
                };
                var oContext = this.setCreateContext("/ProjCostHeaderData", 'Group1', oDefaultData);
                oForm.setBindingContext(oContext);
            });
        },
        
        /**
         * Reset the global flag that prevents navigation back to create page
         * This allows users to create new reports after returning to selection
         * @private
         */
        _resetCreateReportFlag: function() {
            var oGlobalModel = this.getOwnerComponent().getModel("globalState");
            if (!oGlobalModel) {
                // Create global state model if it doesn't exist
                oGlobalModel = new JSONModel({
                    reportJustCreated: false,
                    lastCreatedReportId: null
                });
                this.getOwnerComponent().setModel(oGlobalModel, "globalState");
            } else {
                // Reset the flag to allow new report creation
                oGlobalModel.setProperty("/reportJustCreated", false);
                oGlobalModel.setProperty("/lastCreatedReportId", null);
            }
        },
        
        onPressCreate: function() {
            var oSelection = this.getView().byId("SmartForm").getBindingContext().getObject();
            
            // Validate required fields
            if (!oSelection.ProjectExternalID || !oSelection.ReportingMonth) {
                this.showError("inputError");
                return;
            }
            
            // Set CutOff Date - use existing value or default to current date
            if (!oSelection.CutOffDate) {
                oSelection.CutOffDate = new Date(); // Default to current date
            }
            
            // Navigate to create page - report existence check will be done there
            // Convert SAP string format to boolean for URL parameter
            var bLineItems = oSelection.IsLineItemsRequested === "X" || oSelection.IsLineItemsRequested === true;
            
            this.getOwnerComponent().getRouter().navTo("create", {
                projectId: oSelection.ProjectExternalID,
                reportMonth: this.formatDateForURL(oSelection.ReportingMonth),
                cutOffDate: this.formatDateForURL(oSelection.CutOffDate),
                lineItems: bLineItems.toString()
            });
        },
        
        onPressChange: function() {
            var oSelection = this.getView().byId("SmartForm").getBindingContext().getObject();
            
            if (!oSelection.ProjectExternalID || !oSelection.ReportingMonth) {
                this.showError("inputError");
                return;
            }
            
            var oFilter1 = new Filter("ProjectExternalID", FilterOperator.EQ, oSelection.ProjectExternalID);
            var oFilter2 = new Filter("ReportingMonth", FilterOperator.EQ, oSelection.ReportingMonth);
            var aFilters = [oFilter1, oFilter2];
            
            this.getModel().read("/ProjectCostRept", {
                filters: aFilters,
                success: (oResult) => {
                    var oData = oResult.results[0];
                    if (oData) {
                        // Get the cut off date from the selection
                        var sCutOffDate = this.formatDateForURL(oSelection.CutOffDate || new Date());
                        
                        // Navigate to change page with cutOffDate
                        this.getOwnerComponent().getRouter().navTo("change", {
                            reportId: oData.ReportNumber,
                            cutOffDate: sCutOffDate
                        });
                    } else {
                        this.showError("noReportExist");
                    }
                },
                error: () => {
                    this.showError("error");
                }
            });
        },
        
        onPressDisplay: function() {
            var oSelection = this.getView().byId("SmartForm").getBindingContext().getObject();
            
            if (!oSelection.ProjectExternalID || !oSelection.ReportingMonth) {
                this.showError("inputError");
                return;
            }
            
            var oFilter1 = new Filter("ProjectExternalID", FilterOperator.EQ, oSelection.ProjectExternalID);
            var oFilter2 = new Filter("ReportingMonth", FilterOperator.EQ, oSelection.ReportingMonth);
            var aFilters = [oFilter1, oFilter2];
            
            this.getModel().read("/ProjectCostRept", {
                filters: aFilters,
                success: (oResult) => {
                    var oData = oResult.results[0];
                    if (oData) {
                        // Navigate to display page
                        this.getOwnerComponent().getRouter().navTo("display", {
                            reportId: oData.ReportNumber
                        });
                    } else {
                        this.showError("noReportExist");
                    }
                },
                error: () => {
                    this.showError("error");
                }
            });
        },
        
        formatDateForURL: function(date) {
            if (!date) return "";
            var d = new Date(date);
            return d.getFullYear() + "-" + 
                   String(d.getMonth() + 1).padStart(2, '0') + "-" + 
                   String(d.getDate()).padStart(2, '0');
        },
        
        formatBooleanFromString: function(sValue) {
            // Convert SAP string to boolean for Switch control
            return sValue === "X" || sValue === true;
        },
        
        onLineItemsRequestedChange: function(oEvent) {
            // Convert boolean back to SAP string format
            var bState = oEvent.getParameter("state");
            var sValue = bState ? "X" : "";
            
            // Update the model
            var oContext = this.getView().byId("SmartForm").getBindingContext();
            var oModel = oContext.getModel();
            oModel.setProperty(oContext.getPath() + "/IsLineItemsRequested", sValue);
        },

        /**
         * Format percentage values to display with % symbol
         * @param {number} value - The decimal value to format as percentage
         * @returns {string} Formatted percentage string
         */
        formatPercentage: function(value) {
            if (value === null || value === undefined || value === "") {
                return "";
            }
            
            // Convert to number if it's a string
            var numValue = parseFloat(value);
            if (isNaN(numValue)) {
                return "";
            }
            
            // Multiply by 100 and format with 2 decimal places, then add %
            return (numValue * 100).toFixed(2) + "%";
        }
    });
});