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
            console.log("=== ReportCreate onInit CALLED ===", new Date().toISOString());
            
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
        
        /**
         * Cleanup when the view is destroyed to prevent duplicate ID errors
         */
        onExit: function() {
            // Destroy TablePersoControllers to prevent duplicate ID errors on re-navigation
            if (this._oHITablePersoController) {
                this._oHITablePersoController.destroy();
                this._oHITablePersoController = null;
            }
            if (this._oValuationTablePersoController) {
                this._oValuationTablePersoController.destroy();
                this._oValuationTablePersoController = null;
            }
            if (this._oCostDetailTablePersoController) {
                this._oCostDetailTablePersoController.destroy();
                this._oCostDetailTablePersoController = null;
            }
            if (this._oCostItemTablePersoController) {
                this._oCostItemTablePersoController.destroy();
                this._oCostItemTablePersoController = null;
            }
        },
        
        _onCreateMatched: function(oEvent) {
            console.log("=== _onCreateMatched CALLED ===", new Date().toISOString());
            
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
                // Parse YYYY-MM-DD format and create UTC date to avoid timezone shifts
                var monthParts = sReportMonth.split('-');
                if (monthParts.length === 3) {
                    // Create date at UTC noon to avoid timezone shifts when OData converts
                    dReportMonth = new Date(Date.UTC(parseInt(monthParts[0]), parseInt(monthParts[1]) - 1, parseInt(monthParts[2]), 12, 0, 0));
                } else {
                    dReportMonth = new Date(sReportMonth);
                }
            }
            
            // Parse cutoff date from URL format (YYYY-MM-DD), default to today if invalid
            var dCutOffDate = null;
            if (sCutOffDate) {
                // Parse YYYY-MM-DD format explicitly to avoid timezone issues
                var parts = sCutOffDate.split('-');
                if (parts.length === 3) {
                    dCutOffDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                }
                // Check if date is invalid
                if (!dCutOffDate || isNaN(dCutOffDate.getTime())) {
                    dCutOffDate = new Date();
                }
            } else {
                dCutOffDate = new Date();
            }
            
            console.log("CutOffDate from URL:", sCutOffDate, "-> Parsed:", dCutOffDate);
            
            // Parse line items boolean parameter and convert to SAP format
            var bLineItems = false;
            var sIsLineItemsRequested = "";
            if (sLineItems) {
                bLineItems = sLineItems === 'true' || sLineItems === true;
                sIsLineItemsRequested = bLineItems ? "X" : "";
            }
            
            // Check if a report already exists for this project/period before initializing
            this._checkReportExistsAndInitialize(sProjectId, dReportMonth, dCutOffDate, sIsLineItemsRequested, oRouter);
        },
        
        /**
         * Check if a report already exists for the given project and reporting month
         * If exists, show error and redirect; otherwise check previous month's approval status
         * @param {string} sProjectId Project External ID
         * @param {Date} dReportMonth Reporting Month
         * @param {Date} dCutOffDate Cut Off Date
         * @param {string} sIsLineItemsRequested Line Items requested flag (SAP format)
         * @param {sap.ui.core.routing.Router} oRouter Router instance
         * @private
         */
        _checkReportExistsAndInitialize: function(sProjectId, dReportMonth, dCutOffDate, sIsLineItemsRequested, oRouter) {
            var that = this;
            
            // Build filters to check if report exists for current month
            var aFilters = [
                new Filter("ProjectExternalID", FilterOperator.EQ, sProjectId),
                new Filter("ReportingMonth", FilterOperator.EQ, dReportMonth),
                new Filter("ReportStatus", FilterOperator.NE, 6)
            ];
            
            BusyIndicator.show(0);
            
            this.getModel().read("/ProjectCostRept", {
                filters: aFilters,
                success: function(oResult) {
                    var oExistingReport = oResult.results[0];
                    
                    if (oExistingReport) {
                        // Report already exists - show error and redirect to home
                        BusyIndicator.hide();
                        MessageBox.error(
                            "A cost report has already been created for this month. Please use the 'Change' option to make any modifications.",
                            {
                                title: that.getResourceBundle().getText("error") || "Error",
                                actions: [MessageBox.Action.OK],
                                onClose: function() {
                                    // Redirect to home screen with replace:true to clear history and avoid looping
                                    oRouter.navTo("home", {}, true);
                                }
                            }
                        );
                    } else {
                        // No existing report - check if previous month's report is approved
                        that._checkPreviousMonthApprovalStatus(sProjectId, dReportMonth, dCutOffDate, sIsLineItemsRequested);
                    }
                },
                error: function(oError) {
                    BusyIndicator.hide();
                    console.error("Error checking for existing report:", oError);
                    // Proceed with create anyway if check fails
                    that._proceedWithCreateInitialization(sProjectId, dReportMonth, dCutOffDate, sIsLineItemsRequested);
                }
            });
        },
        
        /**
         * Check if the previous month's report is in approved status (=4)
         * If not approved, show a warning but allow user to proceed
         * Skip warning if this is the first-ever report for the project
         * @param {string} sProjectId Project External ID
         * @param {Date} dReportMonth Current Reporting Month
         * @param {Date} dCutOffDate Cut Off Date
         * @param {string} sIsLineItemsRequested Line Items requested flag (SAP format)
         * @private
         */
        _checkPreviousMonthApprovalStatus: function(sProjectId, dReportMonth, dCutOffDate, sIsLineItemsRequested) {
            var that = this;
            
            // First, check if ANY reports exist for this project (to determine if this is the first-ever report)
            // Using $count for efficiency - only returns the count, not all data
            var aProjectFilters = [
                new Filter("ProjectExternalID", FilterOperator.EQ, sProjectId),
                new Filter("ReportStatus", FilterOperator.NE, 6) // Not deleted
            ];
            
            this.getModel().read("/ProjectCostRept/$count", {
                filters: aProjectFilters,
                success: function(iCount) {
                    if (parseInt(iCount, 10) === 0) {
                        // This is the first-ever report for this project - no need to check previous month
                        BusyIndicator.hide();
                        that._proceedWithCreateInitialization(sProjectId, dReportMonth, dCutOffDate, sIsLineItemsRequested);
                        return;
                    }
                    
                    // Reports exist for this project - check if previous month's report is approved
                    that._checkPreviousMonthReport(sProjectId, dReportMonth, dCutOffDate, sIsLineItemsRequested);
                },
                error: function(oError) {
                    BusyIndicator.hide();
                    console.error("Error checking for existing project reports:", oError);
                    // Proceed with create anyway if check fails
                    that._proceedWithCreateInitialization(sProjectId, dReportMonth, dCutOffDate, sIsLineItemsRequested);
                }
            });
        },
        
        /**
         * Check the previous month's report status when reports already exist for the project
         * @param {string} sProjectId Project External ID
         * @param {Date} dReportMonth Current Reporting Month
         * @param {Date} dCutOffDate Cut Off Date
         * @param {string} sIsLineItemsRequested Line Items requested flag (SAP format)
         * @private
         */
        _checkPreviousMonthReport: function(sProjectId, dReportMonth, dCutOffDate, sIsLineItemsRequested) {
            var that = this;
            
            // Calculate previous month's date
            var dPreviousMonth = new Date(dReportMonth.getTime());
            dPreviousMonth.setMonth(dPreviousMonth.getMonth() - 1);
            
            // Build filters to check previous month's report
            var aFilters = [
                new Filter("ProjectExternalID", FilterOperator.EQ, sProjectId),
                new Filter("ReportingMonth", FilterOperator.EQ, dPreviousMonth),
                new Filter("ReportStatus", FilterOperator.NE, 6) // Not deleted
            ];
            
            this.getModel().read("/ProjectCostRept", {
                filters: aFilters,
                success: function(oResult) {
                    BusyIndicator.hide();
                    var oPreviousReport = oResult.results[0];
                    
                    if (oPreviousReport) {
                        // Previous month's report exists - check if approved (status = 4)
                        if (oPreviousReport.ReportStatus !== "4") {
                            // Previous month's report is NOT approved - show warning
                            var sStatusText = that._getStatusText(oPreviousReport.ReportStatus);
                            var sPreviousMonthFormatted = that._formatMonthYear(dPreviousMonth);
                            
                            MessageBox.warning(
                                "The report for " + sPreviousMonthFormatted + " is currently in '" + sStatusText + "' status and has not been approved yet. " +
                                "It is recommended to approve the previous month's report before creating a new one.\n\n" +
                                "Do you want to continue creating a new report anyway?",
                                {
                                    title: "Previous Month Report Not Approved",
                                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                                    emphasizedAction: MessageBox.Action.NO,
                                    onClose: function(sAction) {
                                        if (sAction === MessageBox.Action.YES) {
                                            // User chose to proceed
                                            that._proceedWithCreateInitialization(sProjectId, dReportMonth, dCutOffDate, sIsLineItemsRequested);
                                        } else {
                                            // User chose not to proceed - redirect to home
                                            that.getOwnerComponent().getRouter().navTo("home", {}, true);
                                        }
                                    }
                                }
                            );
                        } else {
                            // Previous month's report is approved - proceed normally
                            that._proceedWithCreateInitialization(sProjectId, dReportMonth, dCutOffDate, sIsLineItemsRequested);
                        }
                    } else {
                        // No previous month's report exists but other reports do - show warning
                        var sPreviousMonthFormatted = that._formatMonthYear(dPreviousMonth);
                        
                        MessageBox.warning(
                            "No cost report exists for " + sPreviousMonthFormatted + ". " +
                            "It is recommended to create and approve the previous month's report before creating a new one.\n\n" +
                            "Do you want to continue creating a new report anyway?",
                            {
                                title: "Previous Month Report Missing",
                                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                                emphasizedAction: MessageBox.Action.NO,
                                onClose: function(sAction) {
                                    if (sAction === MessageBox.Action.YES) {
                                        // User chose to proceed
                                        that._proceedWithCreateInitialization(sProjectId, dReportMonth, dCutOffDate, sIsLineItemsRequested);
                                    } else {
                                        // User chose not to proceed - redirect to home
                                        that.getOwnerComponent().getRouter().navTo("home", {}, true);
                                    }
                                }
                            }
                        );
                    }
                },
                error: function(oError) {
                    BusyIndicator.hide();
                    console.error("Error checking previous month's report:", oError);
                    // Proceed with create anyway if check fails
                    that._proceedWithCreateInitialization(sProjectId, dReportMonth, dCutOffDate, sIsLineItemsRequested);
                }
            });
        },
        
        /**
         * Get readable status text from status code
         * @param {string} sStatus Status code
         * @returns {string} Status text
         * @private
         */
        _getStatusText: function(sStatus) {
            switch (sStatus) {
                case "1": return "Created";
                case "2": return "In Review";
                case "3": return "Reviewed";
                case "4": return "Approved";
                case "5": return "Rejected";
                case "6": return "Deleted";
                default: return "Unknown";
            }
        },
        
        /**
         * Format date to Month Year string
         * @param {Date} dDate Date to format
         * @returns {string} Formatted string (e.g., "January 2026")
         * @private
         */
        _formatMonthYear: function(dDate) {
            var aMonths = ["January", "February", "March", "April", "May", "June",
                          "July", "August", "September", "October", "November", "December"];
            return aMonths[dDate.getMonth()] + " " + dDate.getFullYear();
        },
        
        /**
         * Proceed with create page initialization after confirming no report exists
         * @param {string} sProjectId Project External ID
         * @param {Date} dReportMonth Reporting Month
         * @param {Date} dCutOffDate Cut Off Date
         * @param {string} sIsLineItemsRequested Line Items requested flag (SAP format)
         * @private
         */
        _proceedWithCreateInitialization: function(sProjectId, dReportMonth, dCutOffDate, sIsLineItemsRequested) {
            // Store CutOffDate as controller property for use in other methods
            this.CutOffDate = dCutOffDate;
            
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
                        // Use replace:true to clear navigation history and avoid looping
                        this.getOwnerComponent().getRouter().navTo("home", {}, true);
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
                // Use CutOffDate stored in controller property (from URL parameter)
                var dCutOffDate = this.CutOffDate || new Date();
                
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