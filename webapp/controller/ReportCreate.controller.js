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
    
    return BaseController.extend("com.atg.ppm.postfinrevenue.controller.ReportCreate", {
        onInit: function() {
            // Initialize UI controls
            this.UIControls = this.getUIControlls();
            
            // Initialize form and tables
            this.UIControls.HeaderSmartForm = this.getView().byId("HeaderSmartForm");
            this.UIControls.HeaderItemTable = this.getView().byId("HeaderItemTable");
            this.UIControls.ValuationTable = this.getView().byId("ValuationTable");
            this.UIControls.CostSummaryTable = this.getView().byId("CostSummaryTable");
            this.UIControls.CostItemTable = this.getView().byId("CostItemTable");
            this.UIControls.Section1 = this.getView().byId("Section1");
            
            // Initialize view models
            var oViewControlModel = this.createViewModel();
            this.getView().setModel(oViewControlModel, 'ViewControl');
            
            var oCurrModel = this.createCurrencyModel();
            this.getView().setModel(oCurrModel, 'Currency');
            
            this.Models = this.getAllModels();
            this.Models.ViewControl = this.getView().getModel('ViewControl');
            this.Models.Currency = this.getView().getModel('Currency');
            
            // Set create mode
            this.Models.ViewControl.setProperty('/Mode/IsCreate', true);
            this.Models.ViewControl.setProperty('/Mode/IsUpdate', false);
            this.Models.ViewControl.setProperty('/Mode/IsEditable', true);
            
            // Make sections visible immediately for create screen (no selection screen)
            this.Models.ViewControl.setProperty('/Sections/IsVisible', true);
            this.Models.ViewControl.setProperty('/SelectionScreen/IsVisible', false);
            
            // Attach to route matched event
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("create").attachPatternMatched(this._onCreateMatched, this);
            
            // Initialize table personalizers
            this._oHITablePersoController = TablePersonalizer.create(this.UIControls.HeaderItemTable);
            this._oValuationTablePersoController = TablePersonalizer.create(this.UIControls.ValuationTable);
            this._oCostDetailTablePersoController = TablePersonalizer.create(this.UIControls.CostSummaryTable);
            this._oCostItemTablePersoController = TablePersonalizer.create(this.UIControls.CostItemTable);
            
            // Initialize JSON model for cost detail data (same approach as Change scenario)
            this._oCostDetailModel = new JSONModel({ items: [] });
        },
        
        _onCreateMatched: function(oEvent) {
            // Check if user is trying to access create page after creating a report
            var oRouter = this.getOwnerComponent().getRouter();
            var oHistory = sap.ui.core.routing.History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();
            
            // Check if there's a flag indicating a report was just created
            var oGlobalModel = this.getOwnerComponent().getModel("globalState");
            if (!oGlobalModel) {
                // Create global state model if it doesn't exist
                oGlobalModel = new JSONModel({
                    reportJustCreated: false,
                    lastCreatedReportId: null
                });
                this.getOwnerComponent().setModel(oGlobalModel, "globalState");
            }
            
            var bReportJustCreated = oGlobalModel.getProperty("/reportJustCreated");
            
            // If a report was just created and user is trying to navigate back to create page
            if (bReportJustCreated) {
                var sLastCreatedReportId = oGlobalModel.getProperty("/lastCreatedReportId");
                MessageBox.warning(
                    "A report has already been created. You cannot create another report for the same project/period. Redirecting to the existing report.", 
                    {
                        title: "Report Already Created",
                        actions: [MessageBox.Action.OK],
                        onClose: function() {
                            // Reset the flag and redirect to the created report
                            oGlobalModel.setProperty("/reportJustCreated", false);
                            if (sLastCreatedReportId) {
                                // Get CutOffDate from header context if available, otherwise use current date
                                var oHeaderContext = this.UIControls.HeaderSmartForm ? this.UIControls.HeaderSmartForm.getBindingContext() : null;
                                var dCutOffDate = oHeaderContext ? oHeaderContext.getObject().CutOffDate : new Date();
                                var sCutOffDate = this.formatDateForURL(dCutOffDate || new Date());
                                oRouter.navTo("change", {
                                    reportId: sLastCreatedReportId,
                                    cutOffDate: sCutOffDate
                                });
                            } else {
                                // Fallback to home if no report ID
                                oRouter.navTo("home");
                            }
                        }.bind(this)
                    }
                );
                return; // Exit early to prevent normal create page initialization
            }
            
            var oArgs = oEvent.getParameter("arguments");
            var sProjectId = oArgs.projectId;
            var sReportMonth = oArgs.reportMonth;
            var sCutOffDate = oArgs.cutOffDate;
            var sLineItems = oArgs.lineItems;
            
            // Store parameters for later use
            this.sProjectId = sProjectId;
            this.sReportMonth = sReportMonth;
            this.sCutOffDate = sCutOffDate;
            
            // Convert dates back to Date objects if needed
            var dReportMonth = null;
            if (sReportMonth) {
                dReportMonth = new Date(sReportMonth);
            }
            
            var dCutOffDate = null;
            if (sCutOffDate) {
                dCutOffDate = new Date(sCutOffDate);
            }
            
            // Parse line items boolean parameter and convert to SAP format
            var bLineItems = false;
            var sIsLineItemsRequested = "";
            if (sLineItems) {
                bLineItems = sLineItems === 'true' || sLineItems === true;
                sIsLineItemsRequested = bLineItems ? "X" : "";
            }
            
            // Set up filters for data loading
            var oFilter = new Filter("ProjectExternalID", FilterOperator.EQ, sProjectId);
            var aFilters = [oFilter];
            
            // Create selection object with route parameters
            var oSelection = {
                ProjectExternalID: sProjectId,
                ReportingMonth: dReportMonth,
                CutOffDate: dCutOffDate,
                IsLineItemsRequested: sIsLineItemsRequested
            };
            
            // Initialize the report with selection parameters for create mode
            this.initReport("/ProjCostHeaderData", aFilters, this.UIControls, this.Models, oSelection, "01");
            
            // Set the form values with the passed parameters
            this._setInitialFormValues(sProjectId, dReportMonth, dCutOffDate, sIsLineItemsRequested);
            
            // Bind Cost Summary table to parameterized entity for better performance
            setTimeout(() => {
                this._bindCostDetailParameterized(sProjectId);
            }, 1000);
        },
        
        /**
         * Set initial form values from route parameters
         * @param {string} sProjectId Project External ID
         * @param {Date} dReportMonth Reporting Month
         * @param {Date} dCutOffDate Cut Off Date
         * @param {boolean} bLineItems Line Items requested flag
         * @private
         */
        _setInitialFormValues: function(sProjectId, dReportMonth, dCutOffDate, sIsLineItemsRequested) {
            // Wait for form to be bound before setting values
            setTimeout(() => {
                var oForm = this.UIControls.HeaderSmartForm;
                if (oForm && oForm.getBindingContext()) {
                    var oContext = oForm.getBindingContext();
                    var oData = oContext.getObject();
                    
                    // Set the form field values
                    if (sProjectId) {
                        oData.ProjectExternalID = sProjectId;
                    }
                    if (dReportMonth) {
                        oData.ReportingMonth = dReportMonth;
                    }
                    if (dCutOffDate) {
                        oData.CutOffDate = dCutOffDate;
                    }
                    if (sIsLineItemsRequested !== undefined) {
                        oData.IsLineItemsRequested = sIsLineItemsRequested;
                        // Also set ItemReport for consistency
                        oData.ItemReport = sIsLineItemsRequested === "X";
                    }
                    
                    // Update the model with new data
                    oContext.getModel().setProperty(oContext.getPath(), oData);
                }
            }, 500); // Small delay to ensure form is properly initialized
        },
        
        onNavBack: function() {
            // Show confirmation if needed
            MessageBox.confirm(this.getResourceBundle().getText('leaveWarning'), {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        this.getOwnerComponent().getRouter().navTo("home");
                    }
                }
            });
        },
        
        // Copy methods from ProjectCostReport.controller.js for create functionality
        onClickRefresh: function() {

            this.setHeaderSmartFormProperties(this.UIControls.HeaderSmartForm);

            // Update sequence: Cost Summary first, then Valuation, then Header Item
            this.setCostSummaryTableFields(this.UIControls.CostSummaryTable);
            this.calculateTableTotals(this.UIControls.CostSummaryTable);

            this.setCostItemTableFields(this.UIControls.CostItemTable);
            this.calculateTableTotals(this.UIControls.CostItemTable);

            this.setValuationTableFields(this.UIControls.ValuationTable);
            this.generateTotalFooter(this.UIControls.ValuationTable);
            this.formatValuationTable(this.UIControls.ValuationTable);

            this.setHeaderItemTableFields(this.UIControls.HeaderSmartForm, this.UIControls.HeaderItemTable, this.UIControls.ValuationTable, this.getCostTable(this.UIControls));
            this.generateTotalFooter(this.UIControls.HeaderItemTable);
            this.formatHeaderItemTable(this.UIControls.HeaderItemTable);

            MessageToast.show("Values Updated");
        },
        
        onClickReset: function() {
            // Copy from ProjectCostReport.controller.js
            var oModel = this.getModel();
            
            MessageBox.confirm(this.getResourceBundle().getText("resetConfirmation"), {
                title: this.getResourceBundle().getText("resetTitle"),
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        // Show busy indicator
                        BusyIndicator.show(0);
                        
                        try {
                            // Reset form to initial values
                            var oContext = this.UIControls.HeaderSmartForm.getBindingContext();
                            if (oContext) {
                                var oObject = oContext.getObject();
                                for (var prop in oObject) {
                                    // Skip metadata properties
                                    if (prop !== "__metadata" && prop.indexOf("__") !== 0) {
                                        if (typeof oObject[prop] === "number") {
                                            oModel.setProperty(oContext.getPath() + "/" + prop, 0);
                                        } else if (typeof oObject[prop] === "string") {
                                            oModel.setProperty(oContext.getPath() + "/" + prop, "");
                                        } else if (typeof oObject[prop] === "boolean") {
                                            oModel.setProperty(oContext.getPath() + "/" + prop, false);
                                        }
                                    }
                                }
                            }
                            
                            // Refresh all tables
                            this.refreshTable(this.UIControls.HeaderItemTable);
                            this.refreshTable(this.UIControls.ValuationTable);
                            this.refreshTable(this.UIControls.CostSummaryTable);
                            this.refreshTable(this.UIControls.CostItemTable);
                            
                            MessageToast.show(this.getResourceBundle().getText("resetSuccess"));
                        } catch (oError) {
                            MessageBox.error(this.getResourceBundle().getText("resetError") + ": " + oError.message);
                        } finally {
                            BusyIndicator.hide();
                        }
                    }
                }
            });
        },
        
        onPressCreateReport: function() {
            this.createReport(this.UIControls, this.Models);
        },
        
        /**
         * Bind Cost Summary table to parameterized entity using JSON model approach
         * This is consistent with the Change scenario for better full-screen dialog support
         * Gets CutOffDate from HeaderSmartForm binding context instead of controller property
         * @param {string} sProjectId - Project External ID
         * @private
         */
        _bindCostDetailParameterized: function(sProjectId) {
            var that = this;
            
            if (!sProjectId) {
                console.warn("ProjectExternalID not available for parameterized binding");
                return;
            }
            
            var oCostSummaryTable = this.UIControls.CostSummaryTable;
            var oCostItemTable = this.UIControls.CostItemTable;
            
            if (!oCostSummaryTable) {
                console.warn("Cost Summary Table not found");
                return;
            }
            
            try {
                // Get CutOffDate from header context instead of controller property
                var oHeaderContext = this.UIControls.HeaderSmartForm.getBindingContext();
                var dCutOffDate = oHeaderContext ? oHeaderContext.getObject().CutOffDate : new Date();
                
                // Construct parameterized entity path
                // Entity: P_RptCostDetailData requires parameters p_project and p_cutoffdate
                var sCutOffDateFormatted = this.formatDateToYYYYmmDD(dCutOffDate);
                var sParameterizedPath = "/P_RptCostDetailData(p_project='" + encodeURIComponent(sProjectId) + "',p_cutoffdate='" + sCutOffDateFormatted + "')/Set";
                
                console.log("Reading from parameterized path: " + sParameterizedPath);
                
                // Read data from parameterized entity (FAST)
                this.getModel().read(sParameterizedPath, {
                    success: function(oCostData) {
                        console.log("Parameterized entity returned " + oCostData.results.length + " records");
                        
                        // Set data to JSON model
                        that._oCostDetailModel.setData({ items: oCostData.results });
                        
                        // Determine which table is visible and bind to JSON model
                        if (oCostSummaryTable && oCostSummaryTable.getVisible()) {
                            // Unbind from OData first
                            oCostSummaryTable.unbindRows();
                            
                            // Set the JSON model as the DEFAULT model on the table (no name)
                            // This allows existing column bindings like {WBSLevel2Descr} to work
                            oCostSummaryTable.setModel(that._oCostDetailModel);
                            
                            // Bind rows to JSON model path
                            oCostSummaryTable.bindRows({
                                path: "/items",
                                sorter: new sap.ui.model.Sorter('counter', false)
                            });
                            
                            console.log("Cost Summary table bound to JSON model with " + oCostData.results.length + " items");
                            
                            // Calculate totals after data is set
                            setTimeout(function() {
                                that.calculateTableTotals(oCostSummaryTable);
                            }, 100);
                        }
                        
                        if (oCostItemTable && oCostItemTable.getVisible()) {
                            // Unbind from OData first
                            oCostItemTable.unbindRows();
                            
                            // Set the JSON model as the DEFAULT model on the table (no name)
                            oCostItemTable.setModel(that._oCostDetailModel);
                            
                            // Bind rows to JSON model path
                            oCostItemTable.bindRows({
                                path: "/items",
                                sorter: new sap.ui.model.Sorter('counter', false)
                            });
                            
                            console.log("Cost Item table bound to JSON model with " + oCostData.results.length + " items");
                            
                            // Calculate totals after data is set
                            setTimeout(function() {
                                that.calculateTableTotals(oCostItemTable);
                            }, 100);
                        }
                        
                        that.showSkeletonScreen(false);
                    },
                    error: function(oError) {
                        console.error("Error reading from parameterized entity:", oError);
                        that.showSkeletonScreen(false);
                        that.showError2("Failed to load cost details: " + that.getTextFromOdataError(oError));
                    }
                });
                
                console.log("Cost Summary table binding initiated for: " + sParameterizedPath);
            } catch (error) {
                console.error("Error binding to parameterized entity:", error);
                // Fallback: Keep existing binding if parameterized binding fails
            }
        },
        
        // Include other methods from ProjectCostReport.controller.js needed for create functionality
        // ...
    });
});