sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageBox",
  "sap/ui/core/BusyIndicator",
  "./AuthorizationHelper",
  "sap/ui/model/json/JSONModel"
], (BaseController, MessageBox, BusyIndicator, AuthorizationHelper, JSONModel) => {
  "use strict";

  return BaseController.extend("com.atg.ppm.postfinrevenue.controller.App", {
    onInit() {
    },

    onAfterRendering() {
      // Get UI controls if they exist
      var UIControls = this.UIControls;

      if (UIControls) {
        // Refresh each table after rendering to ensure proper calculations and formatting
        try {
          if (UIControls.HeaderItemTable && UIControls.HeaderItemTable.getVisible()) {
            var oBinding = UIControls.HeaderItemTable.getBinding("items");
            if (oBinding) {
              oBinding.attachEvent("dataReceived", () => {
                this.refreshTable(UIControls.HeaderItemTable);
              });
            }
            this.refreshTable(UIControls.HeaderItemTable);
          }
        } catch (e) {
          console.warn("Could not refresh HeaderItemTable:", e);
        }

        try {
          if (UIControls.ValuationTable && UIControls.ValuationTable.getVisible()) {
            var oBinding = UIControls.ValuationTable.getBinding("items");
            if (oBinding) {
              oBinding.attachEvent("dataReceived", () => {
                this.refreshTable(UIControls.ValuationTable);
              });
            }
            this.refreshTable(UIControls.ValuationTable);
          }
        } catch (e) {
          console.warn("Could not refresh ValuationTable:", e);
        }

        // Cost tables: Use event-driven approach to refresh after data is loaded
        try {
          if (UIControls.CostSummaryTable && UIControls.CostSummaryTable.getVisible()) {
            var oCostSummaryBinding = UIControls.CostSummaryTable.getBinding("rows");
            if (oCostSummaryBinding) {
              var that = this;
              oCostSummaryBinding.attachEventOnce("dataReceived", function () {
                that.refreshTable(UIControls.CostSummaryTable);
              });
            }
          }
        } catch (e) {
          console.warn("Could not set up CostSummaryTable refresh:", e);
        }

        try {
          if (UIControls.CostItemTable && UIControls.CostItemTable.getVisible()) {
            var oCostItemBinding = UIControls.CostItemTable.getBinding("rows");
            if (oCostItemBinding) {
              var that = this;
              oCostItemBinding.attachEventOnce("dataReceived", function () {
                that.refreshTable(UIControls.CostItemTable);
              });
            }
          }
        } catch (e) {
          console.warn("Could not set up CostItemTable refresh:", e);
        }
      }
    },

    getResourceBundle() {
      return this.getView().getModel("i18n").getResourceBundle();
    },
    geti18nText(code) {
      var text = this.getResourceBundle().getText(code);
      return text;
    },
    getModel() {
      return this.getOwnerComponent().getModel();
    },
    createCurrencyModel() {
      var oCurrModel = new sap.ui.model.json.JSONModel(
        {
          Currency: 'AED'
        });
      return oCurrModel;
    },
    createViewModel() {
      var oViewControlModel = new sap.ui.model.json.JSONModel(
        {
          Title: "Initial Text",
          Sections: {
            IsVisible: false
          },
          SelectionScreen: {
            IsVisible: true
          },
          Mode: {
            IsUpdate: false,
            IsCreate: false,
            IsEditable: true

          },
          Tables: {
            ShowCostItem: false,
            ShowCostSummary: true
          },
          SmartField: {
            ReportStatus: false,
            MainContractNo: false,

            ClientName: false,
            ProjectStatus: false,
            ProjectNumber: false,
            ProjectName: false,
            ProjectManager: false,
            ProjectQS: false,


            RevisedCompletionDate: true,
            DelayInDays: false,
            ReportingMonth: false,
            ValuationDate: true,

            MainContractCurrentSell: false,
            TenderMarginOnRevenue: true,
            TenderMarginCombined_F: false,
            AprvVariationCurrentSell: true,
            UnaprvVariationCurrentSell: true,
            ProjFinalAccountCurrentSell: false,
            PotFinalAccountCurrentSell: true,
            TenderMarginTurnkey_F: true,
            TenderMarginJoinery_F: true,
            Remarks: true,
            TurnkeyTenderValue: true,
            JoineryTenderValue: true


          }


        }
      );
      return oViewControlModel;
    },
    showError2(text) {

      MessageBox.error(text
        , {
          icon: MessageBox.Icon.Error,
          title: "Error",
        });
    },
    showError(code) {
      var text = this.getResourceBundle().getText(code);
      MessageBox.error(text
        , {
          icon: MessageBox.Icon.Error,
          title: "Error",
        });
    },
    showSuccess(code) {
      var text = this.getResourceBundle().getText(code);
      MessageBox.success(text
        , {
          icon: MessageBox.Icon.Error,
          title: "Success",
        });
    },
    showInformation(code) {
      var text = this.getResourceBundle().getText(code);
      MessageBox.information(text
        , {
          icon: MessageBox.Icon.Info,
          title: "Info",
        });

    },
    getUIControlls() {
      return {
        SmartForm: null,
        HeaderSmartForm: null,
        Section1: null,
        Section2: null,
        Section3: null,
        Section4: null,
        ObjectPageLayout: null,
        HeaderItemSmartTable: null,
        HeaderItemTable: null,
        ValuationTable: null,
        CostSummaryTable: null,
        CostItemTable: null
      };
    },
    getAllModels() {
      return {
        oModel: this.getModel(),
        ViewControl: null,
        Currency: null
      };
    },

    generateTotalFooter(Table) {

      Table.getColumns().forEach((col, ind) => {

        if (col.getHeader().getText() == 'WBS Element' || col.getHeader().getText() == 'Project Type') {
          return;
        }


        var grandTotal = 0;
        var colName;
        var oTemplate = Table.getBindingInfo('items').template.getCells()[ind];
        var value = null;
        var text = null;
        var currency;
        var count = 0;

        // Check if the template is directly bound (Text or Input)
        if (oTemplate.getBindingInfo && typeof oTemplate.getBindingInfo === "function") {
          value = oTemplate.getBindingInfo('value');
          text = oTemplate.getBindingInfo('text');
        }

        // If no direct binding found, check if it's an HBox with nested controls
        if ((!value && !text) && oTemplate.getItems && oTemplate.getItems().length > 0) {
          var aItems = oTemplate.getItems();
          for (var i = 0; i < aItems.length; i++) {
            var oItem = aItems[i];
            if (oItem && typeof oItem.getBindingInfo === "function") {
              // Check for value binding (Input controls)
              var itemValue = oItem.getBindingInfo("value");
              if (itemValue) {
                value = itemValue;
                break;
              }
              // Check for text binding (Text controls)
              var itemText = oItem.getBindingInfo("text");
              if (itemText) {
                text = itemText;
                break;
              }
            }
          }
        }

        if (!value && !text) {
          return; // Skip if no binding info found
        }

        colName = value ? value.parts[0].path : text.parts[0].path;

        count = Table.getItems().length ? Table.getItems().length : 0;

        Table.getItems().forEach((row, ind) => {

          var oData = row.getBindingContext().getObject();
          var amount = oData[colName];
          amount = parseFloat(amount);

          if (!isNaN(amount)) {
            grandTotal = grandTotal + amount;
          }
          else
            grandTotal = undefined;

          if (oData.TransactionCurrency) {
            currency = oData.TransactionCurrency;
          }
          if (oData.ProjectCurrency) {
            currency = oData.TransactionCurrency;
          }

        });

        grandTotal = this.convertToSAPCurrFormat(grandTotal);
        if (colName === 'ForecastFinalMargin_F') {
          var totalMargin = 0;
          var totalValue = 0;
          Table.getItems().forEach((row) => {
            var oData = row.getBindingContext().getObject();
            var margin = this.getNumber(oData.ForecastFinalMargin);
            var val = this.getNumber(oData.ForecastFinalValue);
            totalMargin += margin;
            totalValue += val;
          });
          var totalMarginPercent = (totalValue !== 0) ? (totalMargin / totalValue) * 100 : 0;

          col.setFooter(
            new sap.m.HBox({
              justifyContent: "End",
              items: [
                new sap.m.Text({
                  text: totalMarginPercent.toFixed(2) + "%",
                  textAlign: "End"
                })
              ]
            })
          );
        } else {
          col.setFooter(
            new sap.m.HBox({
              justifyContent: "End",
              items: [
                new sap.m.Text({
                  text: grandTotal + " " + (currency || "AED"),
                  textAlign: "End"
                })
              ]
            })
          );
        }
      });

    },

    calculateTableTotals(Table, property) {

      // Optimization: Fetch contexts once
      var oBinding = Table.getBinding("rows");
      if (!oBinding) return;
      var aContexts = oBinding.getContexts(0, oBinding.getLength());

      Table.getColumns().forEach((col, ind) => {
        // Property exists in the array
        // ...your logic...
        const costItemProperties = [
          "WBSLevel2Descr",
          "WBSLevel3Descr",
          "WBSLevel4Descr",
          "Remarks",
          "Item",
          "ItemText",
          "PONumber",
          "POValue",
          "PreviousTotalLiability",
          "MonthsMovement"
        ];

        var subTotal = 0;
        var grandTotal = 0;
        var colName;
        var oTemplate = Table.getColumns()[ind].getTemplate();
        var value = null;
        var text = null;
        var currency;

        // Handle different template types
        if (oTemplate.getBindingInfo) {
          // Direct binding on the template (Text, Input, etc.)
          value = oTemplate.getBindingInfo("value");
          text = oTemplate.getBindingInfo("text");
        }

        // If no direct binding found, check if it's a container with nested controls
        if ((!value && !text) && oTemplate.getItems && oTemplate.getItems().length > 0) {
          // HBox with nested controls - check for Input and Text controls
          var aItems = oTemplate.getItems();
          for (var i = 0; i < aItems.length; i++) {
            var oItem = aItems[i];
            if (oItem && typeof oItem.getBindingInfo === "function") {
              // Check for value binding (Input controls)
              var itemValue = oItem.getBindingInfo("value");
              if (itemValue) {
                value = itemValue;
                break;
              }
              // Check for text binding (Text controls)
              var itemText = oItem.getBindingInfo("text");
              if (itemText) {
                text = itemText;
                break;
              }
            }
          }
        }

        if (!value && !text) {
          return; // Skip if no binding info found
        }

        colName = value ? value.parts[0].path : text.parts[0].path;

        if (costItemProperties.includes(colName))
          return;

        aContexts.forEach((oContext, ind) => {
          if (!oContext) {
            return false;
          }
          var oData = oContext.getObject();
          var oModel = oContext.getModel();

          //add subtotals to table
          if (oData.HierarchyLevel === 6) {
            oModel.setProperty(oContext.getPath() + '/' + colName,
              this.convertToSAPCurrFormat(subTotal));
            grandTotal = grandTotal + subTotal;
            subTotal = 0;
            return false;
          }
          //add grand total to table
          if (oData.HierarchyLevel === 7) {
            oModel.setProperty(oContext.getPath() + '/' + colName,
              this.convertToSAPCurrFormat(grandTotal));
            grandTotal = 0;
            return false;
          }

          if (oData.HierarchyLevel === 5) {
            //sum 
            var amount = oData[colName];
            amount = parseFloat(amount);

            if (!isNaN(amount)) {
              subTotal = subTotal + amount;
            }
            else
              subTotal = undefined;

            if (oData.TransactionCurrency) {
              currency = oData.TransactionCurrency;
            }
            if (oData.ProjectCurrency) {
              currency = oData.TransactionCurrency;
            }
          }



          if (oData.HierarchyLevel === 2 || oData.HierarchyLevel === 3 || oData.HierarchyLevel === 4) {
            //sum 
            var amount = oData[colName];
            amount = parseFloat(amount);

            if (!isNaN(amount)) {
              subTotal = subTotal + amount;
            }
            else
              subTotal = undefined;

            if (oData.TransactionCurrency) {
              currency = oData.TransactionCurrency;
            }
            if (oData.ProjectCurrency) {
              currency = oData.TransactionCurrency;
            }
          }

        });

        // grandTotal = this.convertToSAPCurrFormat(grandTotal);

        // col.setFooter(
        //   new sap.m.HBox({
        //     items: [
        //       new sap.m.Text({ text: grandTotal }),
        //       new sap.m.Text({
        //         text: currency || 'AED'
        //       }).addStyleClass("currencySuffix")
        //     ]
        //   })
        // );
      });

    },
    formatCurr(curr) {
      var oCurrencyFormat = sap.ui.core.format.NumberFormat.getCurrencyInstance({
        trailingCurrencyCode: false,
        decimals: 2,
        groupingSeparator: ',', // grouping separator is '.'
        decimalSeparator: "."

      });
      var currName = '';
      return oCurrencyFormat.format(curr, currName);

      // return curr +' '+currName;
    },
    createBindingEntity(path, groupId, aFilters, changeCallback = () => { }) {
      return {
        path: path,
        filters: aFilters,
        parameters: {
          groupId: groupId,

        },
        events: {
          change: changeCallback,
          dataRequested: () => {
          },
          dataReceived: () => {
          }
        }
      }
    },
    createContext(entityPath, groupId, oData) {
      var oContext =
        this.getModel().createEntry(entityPath,
          {
            parameters: { groupId: groupId },
            properties: oData

          });

      return oContext;
    },
    getDefaultFormData(oSelection, oData) {
      oData.ReportingMonth = oSelection.ReportingMonth;
      oData.ReportStatus = '1';
      // Always set ItemReport from selection, regardless of existing value
      if (oSelection.IsLineItemsRequested !== undefined) {
        // Convert SAP string format to boolean for ItemReport
        var bIsLineItems = oSelection.IsLineItemsRequested === "X" || oSelection.IsLineItemsRequested === true;
        oData.ItemReport = bIsLineItems;
      }

      // Calculate DelayInDays if both dates are available
      if (oData.RequestedDeliveryDate && oData.RevisedCompletionDate) {
        try {
          var dRequestedDelivery = new Date(oData.RequestedDeliveryDate);
          var dRevisedCompletion = new Date(oData.RevisedCompletionDate);

          // Validate dates are valid
          if (isNaN(dRequestedDelivery.getTime()) || isNaN(dRevisedCompletion.getTime())) {
            oData.DelayInDays = 0;
          } else {
            var timeDiff = dRevisedCompletion.getTime() - dRequestedDelivery.getTime();
            var daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
            oData.DelayInDays = daysDiff; // Keep as integer for Int32 SmartField
          }
        } catch (e) {
          console.error("Error calculating DelayInDays in getDefaultFormData:", e);
          oData.DelayInDays = 0;
        }
      } else {
        oData.DelayInDays = 0; // Default value as integer when dates are missing
      }

      //oData.AprvVariationCurrentSell = "0.0";
      //oData.UnaprvVariationCurrentSell = "0.0";

      return oData;
    },
    initReport(sPath, aFilters, UIControls, Models, oSelection, activity) {
      // Determine which authorization check to perform based on activity
      let authorizationPromise;
      let errorCode;
      
      switch(activity) {
        case "01": // Create
          authorizationPromise = AuthorizationHelper.canCreate(this);
          errorCode = "01";
          break;
        case "02": // Change
          authorizationPromise = AuthorizationHelper.canChange(this);
          errorCode = "02";
          break;
        case "03": // Display
        default:
          authorizationPromise = AuthorizationHelper.canDisplay(this);
          errorCode = "03";
          break;
      }
      
      // Check appropriate authorization based on activity
      authorizationPromise.then((authorized) => {
        if (!authorized) {
          AuthorizationHelper.showAuthorizationErrorAndRedirect(errorCode, this);
          this.resetApp(UIControls, Models);
          return;
        }

        // Show skeleton screen instead of busy indicator
        this.showSkeletonScreen(true);

        if (oSelection) {
          this.CutOffDate = oSelection.CutOffDate;
          this.Project = oSelection.ProjectExternalID;
        }

        this.getModel().read(sPath, {
          urlParameters: {
            "$top": 1,
          },
          //groupId: "Group1",

          filters: aFilters,
          success: (oResult, oResponse) => {
            var oData = oResult.results[0];

            if (!oData) {
              this.showError("nodata");
              
              setTimeout(() => {
                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("home");
              }, 4000);
            }

            // Use the passed oSelection parameter if available
            if (oSelection) {
              oData = this.getDefaultFormData(oSelection, oData);
            }

            if (!this.Project) {
              this.Project = oData.ProjectExternalID;
            }

            var key = oData.ReportNumber;
            if (!key) {
              key = oData.ProjectNumber;
            }
            var RootEntityPath = sPath + "('" + key + "')";
            var RootEntity = this.createBindingEntity(RootEntityPath, 'costChanges');

            this.showBusyUntilAllLoaded(UIControls, Models);

            if (oData.ReportNumber) {
              UIControls.HeaderSmartForm.bindElement(RootEntity);
            } else {

              var oContext = this.createContext("/ProjectCostRept", 'Group2', oData);
              //set default data to Form
              UIControls.HeaderSmartForm.setBindingContext(oContext);
            }

            UIControls.HeaderItemTable.bindElement(RootEntity);

            //RootEntity = this.createBindingEntity(RootEntityPath, 'Group4')

            UIControls.ValuationTable.bindElement(RootEntity);

            // var sDate = oSelectionContext.getProperty('ReportingMonth').toISOString().slice(0, 10);
            // var sDateFormatted  = sDate+"T00:00:00";
            //var ProjectCostSummaryDataEntity = this.createBindingEntity("/ProjectCostSummaryData(p_date=datetime'"+sDateFormatted+"')/Set", null, null);

            var ProjectCostSummaryDataEntity = this.createBindingEntity("/ProjectCostSummaryData", null, aFilters);

            // Determine if this is a line item report
            var isLineItemReport = false;
            if (oData.ItemReport !== undefined) {
              isLineItemReport = oData.ItemReport;
            } else if (oSelection && oSelection.IsLineItemsRequested !== undefined) {
              // Handle SAP string format conversion
              isLineItemReport = oSelection.IsLineItemsRequested === "X" || oSelection.IsLineItemsRequested === true;
            }

            if (isLineItemReport) {
              Models.ViewControl.setProperty('/Tables/ShowCostSummary', false);
              Models.ViewControl.setProperty('/Tables/ShowCostItem', true);
              UIControls.CostItemTable.bindElement(RootEntity);

            } else {
              Models.ViewControl.setProperty('/Tables/ShowCostSummary', true);
              Models.ViewControl.setProperty('/Tables/ShowCostItem', false);
              UIControls.CostSummaryTable.bindElement(RootEntity);

            }
            // UIControls.CostSummaryTable.bindRows(          {
            //           path: "/ProjectCostSummaryData",
            //           filters: aFilters,
            //           events: {
            //               dataReceived: () => {
            //                   oTable.setBusy(false); // Hide busy indicator
            //               }
            //           }
            //       });


            this.initSuccess(Models);

          },
          error: (oError) => {
            this.showSkeletonScreen(false);
            this.showError2(this.getTextFromOdataError(oError));
          }
        });

      }).catch((error) => {
        console.error("Authorization check failed:", error);
        AuthorizationHelper.showAuthorizationErrorAndRedirect(errorCode, this);
        this.resetApp(UIControls, Models);
      });
    },

    initSuccess(Models) {
      this.getModel().resetChanges();
      Models.ViewControl.setProperty("/Sections/IsVisible", true);
      Models.ViewControl.setProperty("/SelectionScreen/IsVisible", false);

      // Ensure SmartForm content is properly loaded before showing
      this.ensureSmartFormContentLoaded();

      // Hide skeleton screen when initialization is successful
      // Note: showBusyUntilAllLoaded will handle hiding the skeleton after all data is loaded
      //BusyIndicator.hide();

    },

    ensureSmartFormContentLoaded: function () {
      // Add a small delay to ensure all SmartForm content and HBox elements are fully rendered
      var that = this;
      setTimeout(function () {
        var oView = that.getView();
        if (oView) {
          var oPage = oView.byId("page") || oView.byId("createPage") || oView.byId("changePage") || oView.byId("displayPage");
          if (oPage) {
            var oPageDomRef = oPage.getDomRef();
            if (oPageDomRef) {
              oPageDomRef.classList.remove("smartFormLoading");
              oPageDomRef.classList.add("smartFormLoaded");
            }
          }
        }
      }, 200); // 200ms delay to ensure all async rendering is complete
    },


    resetApp(UIControls, Models, resetSelect = false) {
      Models.ViewControl.setProperty('/Mode/IsEditable', true);
      Models.ViewControl.setProperty("/SmartField/ReportStatus", false);
      Models.ViewControl.setProperty("/SmartField/RevisedCompletionDate", true);
      Models.ViewControl.setProperty("/SmartField/DelayInDays", true);
      Models.ViewControl.setProperty("/SmartField/ReportingMonth", true);
      Models.ViewControl.setProperty("/SmartField/ValuationDate", true);
      Models.ViewControl.setProperty("/SmartField/MainContractCurrentSell", true);
      Models.ViewControl.setProperty("/SmartField/TenderMarginOnRevenue", true);
      Models.ViewControl.setProperty("/SmartField/TenderMarginCombined_F", true);
      Models.ViewControl.setProperty("/SmartField/AprvVariationCurrentSell", true);
      Models.ViewControl.setProperty("/SmartField/UnaprvVariationCurrentSell", true);
      Models.ViewControl.setProperty("/SmartField/ProjFinalAccountCurrentSell", true);
      Models.ViewControl.setProperty("/SmartField/PotFinalAccountCurrentSell", true);
      Models.ViewControl.setProperty("/SmartField/TenderMarginTurnkey_F", true);
      Models.ViewControl.setProperty("/SmartField/TenderMarginJoinery_F", true);
      Models.ViewControl.setProperty("/SmartField/Remarks", true);
      Models.ViewControl.setProperty("/SmartField/TurnkeyTenderValue", true);
      Models.ViewControl.setProperty("/SmartField/JoineryTenderValue", true);
      Models.ViewControl.setProperty("/SelectionScreen/IsVisible", true);
      Models.ViewControl.setProperty("/Sections/IsVisible", false);
      Models.ViewControl.setProperty('/Mode/IsUpdate', false);
      Models.ViewControl.setProperty('/Mode/IsCreate', false);
      UIControls.HeaderSmartForm.unbindElement();
      UIControls.HeaderItemTable.unbindElement();
      UIControls.ValuationTable.unbindElement();
      this.getCostTable(UIControls).unbindElement();

      if (resetSelect) {
        this.getModel().resetChanges();
      }

      // Hide skeleton screen and busy indicator
      this.showSkeletonScreen(false);
      BusyIndicator.hide();

    },

    validateInputFields(UIControls) {
      var hasErrors = false;
      var errorMessages = [];

      // Function to recursively check inputs in a control and its children
      var checkInputsRecursively = function (control, controlName) {
        if (!control) return;

        // Check if this control is an input with error state
        if (control instanceof sap.m.Input && control.getValueState() !== "None") {
          hasErrors = true;
          var errorText = control.getValueStateText() || "Invalid value";
          errorMessages.push(controlName + ": " + errorText);
        }

        // Check aggregations (content, items, etc.)
        var aAggregationNames = ["content", "items", "cells"];
        aAggregationNames.forEach(function (sAggregationName) {
          if (control.getAggregation && control.getAggregation(sAggregationName)) {
            var aItems = control.getAggregation(sAggregationName);
            if (Array.isArray(aItems)) {
              aItems.forEach(function (oItem) {
                checkInputsRecursively(oItem, controlName);
              });
            } else {
              checkInputsRecursively(aItems, controlName);
            }
          }
        });
      };

      // Function to check all inputs in a table
      var checkTableInputs = function (table, tableName) {
        if (!table || !table.getVisible()) return;

        var rows = table.getRows ? table.getRows() : table.getItems();
        rows.forEach(function (row) {
          var cells = row.getCells ? row.getCells() : row.getAggregation("cells");
          if (cells) {
            cells.forEach(function (cell) {
              checkInputsRecursively(cell, tableName);
            });
          }
        });
      };

      // Function to check smart form inputs
      var checkFormInputs = function (form, formName) {
        if (!form) return;

        var content = form.getContent ? form.getContent() : [];
        content.forEach(function (item) {
          checkInputsRecursively(item, formName);
        });
      };

      // Check all UI controls
      checkFormInputs(UIControls.HeaderSmartForm, "Header Form");
      checkTableInputs(UIControls.HeaderItemTable, "Header Item Table");
      checkTableInputs(UIControls.ValuationTable, "Valuation Table");
      checkTableInputs(UIControls.CostSummaryTable, "Cost Summary Table");
      checkTableInputs(UIControls.CostItemTable, "Cost Item Table");

      if (hasErrors) {
        var errorMessage = "Please fix the following errors before saving:\n" + errorMessages.join("\n");
        this.showError2(errorMessage);
      }

      return !hasErrors;
    },

    createReport(UIControls, Models) {
      // Check authorization before creating
      AuthorizationHelper.canCreate(this).then((authorized) => {
        if (!authorized) {
          AuthorizationHelper.showAuthorizationErrorAndRedirect("01", this);
          return;
        }

        // Validate all input fields before proceeding
        if (!this.validateInputFields(UIControls)) {
          return; // Stop execution if validation fails
        }

        BusyIndicator.show();

        var oData = this.createPayload(UIControls);

        this.getModel().read("/ProjectCostRept", {
          sorters: [
            new sap.ui.model.Sorter("ReportNumber", /*descending*/true) // "Sorter" required from "sap/ui/model/Sorter"
          ],
          urlParameters: {
            "$select": "ReportNumber",
            "$top": 1,
          },
          success: (oData2) => {
            // Handle case when no reports exist yet
            let MaxReportNumber = 1;
            if (oData2.results && oData2.results.length > 0) {
              MaxReportNumber = parseInt(oData2.results[0].ReportNumber);
            }
            const NextReportNumber = MaxReportNumber + 1 + '';

            oData.ReportNumber = NextReportNumber;

            oData.to_HeaderItem.results.forEach(function (e, i) {
              this[i].ReportNumber = NextReportNumber;

            }, oData.to_HeaderItem.results);

            oData.to_Valuation.results.forEach(function (e, i) {
              this[i].ReportNumber = NextReportNumber;

            }, oData.to_Valuation.results);

            oData.to_CostDetail.results.forEach(function (e, i) {
              this[i].ReportNumber = NextReportNumber;

            }, oData.to_CostDetail.results);

            this.getModel().create("/ProjectCostRept", oData, {
              success: (oData, response) => {
                BusyIndicator.hide();
                this.showSuccess("createSuccess");
                this.enableDisplayMode(Models);

                // Set flag to prevent going back to create page
                var oGlobalModel = this.getOwnerComponent().getModel("globalState");
                if (!oGlobalModel) {
                  // Create global state model if it doesn't exist
                  oGlobalModel = new JSONModel({
                    reportJustCreated: false,
                    lastCreatedReportId: null
                  });
                  this.getOwnerComponent().setModel(oGlobalModel, "globalState");
                }

                // Set the flags to prevent navigation back to create page
                oGlobalModel.setProperty("/reportJustCreated", true);
                oGlobalModel.setProperty("/lastCreatedReportId", NextReportNumber);

                // Navigate to update page with the newly created report number after a delay
                // This allows the success message to be visible for a while
                setTimeout(() => {
                  // Unbind and reset changes to ensure clean state for navigation
                  UIControls.HeaderSmartForm.unbindElement();
                  UIControls.HeaderItemTable.unbindElement();
                  UIControls.ValuationTable.unbindElement();
                  var oCostTable = this.getCostTable(UIControls);
                  if (oCostTable) {
                    oCostTable.unbindElement();
                  }
                  this.getModel().resetChanges();

                  var oRouter = this.getOwnerComponent().getRouter();
                  var sCutOffDate = this.formatDateForURL(this.CutOffDate || new Date());
                  oRouter.navTo("change", {
                    reportId: NextReportNumber,
                    cutOffDate: sCutOffDate
                  });
                }, 2000); // 2 second delay to show success message

              },
              error: (oError, oData) => {
                BusyIndicator.hide();
                this.showError2(this.getTextFromOdataError(oError));
              }
            });
          },

          error: (oError, oData) => {
            BusyIndicator.hide();
            this.showError2(this.getTextFromOdataError(oError));
          }
        });

      }).catch((error) => {
        console.error("Authorization check failed:", error);
        AuthorizationHelper.showAuthorizationErrorAndRedirect("01", this);
      });


    },
    updateReport(UIControls, Models, key) {
      // Check authorization before updating
      AuthorizationHelper.canChange(this).then((authorized) => {
        if (!authorized) {
          AuthorizationHelper.showAuthorizationErrorAndRedirect("02", this);
          return;
        }

        // Validate all input fields before proceeding
        if (!this.validateInputFields(UIControls)) {
          return; // Stop execution if validation fails
        }

        BusyIndicator.show();

        var oData = this.createPayload(UIControls, 1);

        if (!this.getModel().hasPendingChanges()) {
          this.showInformation("noupdate");
          BusyIndicator.hide();
          return;
        }
        this.getModel().submitChanges({
          success: (oData) => {

            if (oData.__batchResponses) {
              if (oData.__batchResponses[0].response) {
                if (oData.__batchResponses[0].response.statusCode == 400) {

                  this.showError2(this.getTextFromOdataError(oData.__batchResponses[0].response));
                }
                else {
                  this.showSuccess("updateSuccess");

                }
              } else {
                this.showSuccess("updateSuccess");
              }

              this.calculateTableTotals(this.getCostTable(UIControls));
            }

            BusyIndicator.hide();

          },
          error: (oError) => {
            BusyIndicator.hide();
            this.showError2(this.getTextFromOdataError(oError));
          }
        });

      }).catch((error) => {
        console.error("Authorization check failed:", error);
        AuthorizationHelper.showAuthorizationErrorAndRedirect("02", this);
      });

      // this.getModel().update("/ProjectCostRept('" + key + "')", oData, {
      //   success: (oData, response) => {
      //     BusyIndicator.hide();
      //     this.showSuccess("updateSuccess");

      //   },
      //   error: (oError, oData) => {
      //     BusyIndicator.hide();
      //     this.showError2(this.getTextFromOdataError(oError));
      //   }
      // });
    },
    createPayload(UIControls, Level) {

      var oContext = UIControls.HeaderSmartForm.getBindingContext();
      var header = oContext.getObject();

      // Create a more robust clean copy using a whitelist approach
      var allowedProperties = [
        'ReportNumber', 'ProjectNumber', 'ProjectName', 'ProjectManager', 'ProjectQS',
        'MainContractNo', 'ContractName', 'ProjectStatusDescr', 'ProjectStatus',
        'ProjectManagerDescr', 'ProjectQSDescr', 'CustomerPurchaseOrderDate',
        'RequestedDeliveryDate', 'MainContractTenderValue', 'MainContractCurrentSell',
        'TenderMarginOnRevenue', 'TenderMarginCombined_F', 'TurnkeyTenderValue',
        'JoineryTenderValue', 'TransactionCurrency', 'ValuationDate', 'ReportingMonth',
        'ReportStatus', 'ItemReport', 'AprvVariationCurrentSell', 'UnaprvVariationCurrentSell',
        'ProjFinalAccountCurrentSell', 'PotFinalAccountCurrentSell', 'TenderMarginTurnkey_F',
        'TenderMarginJoinery_F', 'Remarks', 'DelayInDays', 'RevisedCompletionDate'
      ];

      var cleanHeader = {};

      // Use whitelist approach for more predictable results
      allowedProperties.forEach(function (prop) {
        if (header.hasOwnProperty(prop) && header[prop] !== undefined) {
          cleanHeader[prop] = header[prop];
        }
      });


      console.log("Clean header object keys:", Object.keys(cleanHeader));
      console.log("=== END DEBUGGING ===");

      cleanHeader = this.addFieldsToPayload(cleanHeader);
      cleanHeader = this.cleanupPayload(cleanHeader);
      var oData = cleanHeader;

      if (Level == 1) {
        return oData;
      }

      oData.to_HeaderItem = {
        results: this.getItemList(UIControls.HeaderItemTable)
      };
      oData.to_Valuation = {
        results: this.getItemList(UIControls.ValuationTable)
      };
      oData.to_CostDetail = {
        results: this.getRowList(this.getCostTable(UIControls))
      };

      console.log("Final payload structure:", {
        headerKeys: Object.keys(oData).filter(k => !k.startsWith('to_')),
        headerItemCount: oData.to_HeaderItem ? oData.to_HeaderItem.results.length : 0,
        valuationCount: oData.to_Valuation ? oData.to_Valuation.results.length : 0,
        costDetailCount: oData.to_CostDetail ? oData.to_CostDetail.results.length : 0
      });

      return oData;

    },
    getCostTable(UIControls) {
      if (UIControls.CostSummaryTable.getVisible())
        return UIControls.CostSummaryTable;
      if (UIControls.CostItemTable.getVisible())
        return UIControls.CostItemTable;
    },
    addFieldsToPayload(oData) {
      //oData.CurrencyCode = oData.ProjectCurrency;
      return oData;
    },
    getItemList(Table) {
      var ItemDataList = [];
      Table.getItems().forEach((row, ind) => {

        var originalData = row.getBindingContext().getObject();

        // Create a robust clean copy using stricter filtering
        var cleanData = {};
        for (var prop in originalData) {
          if (originalData.hasOwnProperty(prop) &&
            typeof originalData[prop] !== 'object' &&
            typeof originalData[prop] !== 'function' &&
            prop !== '__metadata' &&
            !prop.startsWith('to_') &&
            !prop.endsWith('_oc') &&
            !prop.endsWith('_mc') &&
            !prop.includes('ProjectCostRept(') &&
            !prop.includes('HeaderItem(') &&
            !prop.includes('Valuation(') &&
            !prop.includes('(') &&
            !prop.includes(')') &&
            prop !== 'Delete_mc' &&
            prop !== 'Update_mc' &&
            originalData[prop] !== null &&
            originalData[prop] !== undefined) {
            cleanData[prop] = originalData[prop];
          }
        }

        console.log("Item data before cleanup:", JSON.stringify(cleanData, null, 2));
        cleanData = this.addFieldsToPayload(cleanData);
        cleanData = this.cleanupPayload(cleanData);
        console.log("Item data after cleanup:", JSON.stringify(cleanData, null, 2));
        ItemDataList.push(cleanData);

      });

      return ItemDataList;
    },
    getRowList(Table) {
      var ItemDataList = [];
      // Get all data from binding instead of just visible rows
      var oBinding = Table.getBinding("rows");
      if (!oBinding) return ItemDataList;

      var aContexts = oBinding.getContexts(0, oBinding.getLength());

      aContexts.forEach((oContext, ind) => {
        if (oContext) {
          var originalData = oContext.getObject();

          if (originalData.HierarchyLevel === 6 || originalData.HierarchyLevel === 7) {
            return false;
          }

          // Create a robust clean copy using stricter filtering
          var cleanData = {};
          for (var prop in originalData) {
            if (originalData.hasOwnProperty(prop) &&
              typeof originalData[prop] !== 'object' &&
              typeof originalData[prop] !== 'function' &&
              prop !== '__metadata' &&
              !prop.startsWith('to_') &&
              !prop.endsWith('_oc') &&
              !prop.endsWith('_mc') &&
              !prop.includes('ProjectCostRept(') &&
              !prop.includes('CostDetail(') &&
              !prop.includes('CostItem(') &&
              !prop.includes('(') &&
              !prop.includes(')') &&
              prop !== 'Delete_mc' &&
              prop !== 'Update_mc' &&
              originalData[prop] !== null &&
              originalData[prop] !== undefined) {
              cleanData[prop] = originalData[prop];
            }
          }

          console.log("Row data before cleanup:", JSON.stringify(cleanData, null, 2));
          cleanData = this.addFieldsToPayload(cleanData);
          cleanData = this.cleanupPayload(cleanData);
          console.log("Row data after cleanup:", JSON.stringify(cleanData, null, 2));
          ItemDataList.push(cleanData);
        }
      });

      return ItemDataList;
    },
    getTextFromOdataError: function (oError) {

      try {
        if (oError.body && oError.body) {
          return JSON.parse(oError.body).error.message.value;
        }

        return JSON.parse(oError.responseText).error.message.value;
      } catch (e) {
        return oError.responseText ? oError.responseText : 'Error Occured';
      }

    },

    setHeaderItemTableFields(HeaderSmartForm, HeaderItemTable, ValuationTable, CostTable) {

      var ValuationTableRows = ValuationTable.getItems();

      // Optimization: Pre-process CostTable data into a lookup map
      var costLookup = {};
      var oCostBinding = CostTable.getBinding("rows");
      if (oCostBinding) {
          var aCostContexts = oCostBinding.getContexts(0, oCostBinding.getLength());
          aCostContexts.forEach((oCostContext) => {
              if (!oCostContext) return;
              var oCost = oCostContext.getObject();
              if (oCost.HierarchyLevel === 6) {
                  costLookup[oCost.WBSLevel2] = this.getNumber(oCost.ProjectedFinalCost);
              }
          });
      }

      HeaderItemTable.getItems().forEach((row, ind) => {
        var oValuation = ValuationTableRows[ind].getBindingContext().getObject();
        var oHeaderItem = row.getBindingContext().getObject();
        var oHeader = HeaderSmartForm.getBindingContext().getObject();

        var cxt = row.getBindingContext();
        //var cxt = e.getParameter('listItem').getBindingContext();
        var oModel = cxt.getModel();


        oModel.setProperty(cxt.getPath() + '/CumulCertifToDate',
          this.convertToSAPCurrFormat(oValuation.CumulCertifToDate));
        oModel.setProperty(cxt.getPath() + '/CumulInternalValue',
          this.convertToSAPCurrFormat(oValuation.CumulInternalValuation));
        oModel.setProperty(cxt.getPath() + '/WorkInProgress',

          this.convertToSAPCurrFormat(parseFloat(oValuation.CumulInternalValuation) - parseFloat(oValuation.CumulCertifToDate)));

        var ForecastFinalValue = oHeader.ProjFinalAccountCurrentSell;
        if (this.bInputForecastFinalValue === true) {
          ForecastFinalValue = oHeaderItem.ForecastFinalValue;
          //this.bInputForecastFinalValue = false;
        }
        if (isNaN(ForecastFinalValue))
          ForecastFinalValue = 0;
        oModel.setProperty(cxt.getPath() + '/ForecastFinalValue',
          this.convertToSAPCurrFormat(ForecastFinalValue));

        var ForecastFinalCost = '0.0';

        if (costLookup.hasOwnProperty(oHeaderItem.WBSElement)) {
            ForecastFinalCost = costLookup[oHeaderItem.WBSElement];
        }

        oModel.setProperty(cxt.getPath() + '/ForecastFinalCost',
          this.convertToSAPCurrFormat(ForecastFinalCost));
        var ForecastFinalMargin = parseFloat(ForecastFinalValue) - parseFloat(ForecastFinalCost);
        // if (isNaN(ForecastFinalMargin))
        //   ForecastFinalMargin = 0;

        oModel.setProperty(cxt.getPath() + '/ForecastFinalMargin',
          this.convertToSAPCurrFormat(ForecastFinalMargin));

        // Forecast Final Margin % = Forecast Final Margin / Forecast Final Value * 100
        var ForecastFinalMargin_F = (parseFloat(ForecastFinalValue) !== 0)
          ? (parseFloat(ForecastFinalMargin) / parseFloat(ForecastFinalValue)) * 100
          : 0;
        // if (isNaN(ForecastFinalMargin_F))
        //   ForecastFinalMargin_F = '0';

        oModel.setProperty(cxt.getPath() + '/ForecastFinalMargin_F',
          this.getNumber(ForecastFinalMargin_F).toFixed(2));

        var CumulInternalValuation = oValuation.CumulInternalValuation;
        var PreviousMonthValue = oValuation.PrevInternalValuation;
        oModel.setProperty(cxt.getPath() + '/CumulValueToDate',
          this.convertToSAPCurrFormat(CumulInternalValuation));

        oModel.setProperty(cxt.getPath() + '/PreviousMonthValue',
          this.convertToSAPCurrFormat(PreviousMonthValue));
        oModel.setProperty(cxt.getPath() + '/CurrentMonthValue',
          this.convertToSAPCurrFormat(oValuation.CurrentMonthValue));

        var CumulMarginToDate = (CumulInternalValuation * ForecastFinalMargin_F)/100;
        if (isNaN(CumulMarginToDate))
          CumulMarginToDate = 0;
        oModel.setProperty(cxt.getPath() + '/CumulMarginToDate',
          this.convertToSAPCurrFormat(CumulMarginToDate));

        var PreviousMargin = '0.0';
        oModel.setProperty(cxt.getPath() + '/PreviousMargin',
          this.convertToSAPCurrFormat(PreviousMargin));

        var CurrentMonthMargin = CumulMarginToDate - parseFloat(PreviousMargin);

        oModel.setProperty(cxt.getPath() + '/CurrentMonthMargin',
          this.convertToSAPCurrFormat(CurrentMonthMargin));

        oModel.setProperty(cxt.getPath() + '/FinishingFund',
          this.convertToSAPCurrFormat(oHeaderItem.FinishingFund));


      })

    },

    setValuationTableFields(ValuationTable) {

      ValuationTable.getItems().forEach((row, ind) => {
        var oValuation = row.getBindingContext().getObject();

        var cxt = row.getBindingContext();
        //var cxt = e.getParameter('listItem').getBindingContext();
        var oModel = cxt.getModel();

        var CumulCertifToDate = this.getNumber(oValuation.CumulCertifToDate);
        var PreviouslyCertified = this.getNumber(oValuation.PreviouslyCertified);
        var Movement = CumulCertifToDate - PreviouslyCertified;
        Movement = this.convertToSAPCurrFormat(Movement);

        oModel.setProperty(cxt.getPath() + '/Movement',
          this.convertToSAPCurrFormat(Movement));

        var CumulInternalValuation = this.getNumber(oValuation.CumulInternalValuation);
        var PrevInternalValuation = this.getNumber(oValuation.PrevInternalValuation);
        var CurrentMonthValue = CumulInternalValuation - PrevInternalValuation;

        oModel.setProperty(cxt.getPath() + '/CurrentMonthValue',
          this.convertToSAPCurrFormat(CurrentMonthValue));

        var WorkInProgress = CumulInternalValuation - CumulCertifToDate;
        oModel.setProperty(cxt.getPath() + '/WorkInProgress',
          this.convertToSAPCurrFormat(WorkInProgress));
      })

    },

    formatHeaderItemTable(HeaderItemTableFields) {

      HeaderItemTableFields.getItems().forEach((row, ind) => {
        var cxt = row.getBindingContext();
        var oHeaderItem = cxt.getObject();
        //var cxt = e.getParameter('listItem').getBindingContext();
        var oModel = cxt.getModel();

        oModel.setProperty(cxt.getPath() + '/FinishingFund',
          this.convertToSAPCurrFormat(oHeaderItem.FinishingFund));

      });
    },

    formatValuationTable(ValuationTable) {
      ValuationTable.getItems().forEach((row, ind) => {
        var cxt = row.getBindingContext();
        var oValuation = cxt.getObject();
        //var cxt = e.getParameter('listItem').getBindingContext();
        var oModel = cxt.getModel();

        // oModel.setProperty(cxt.getPath() + '/CumulCertifToDate',
        //   this.convertToSAPCurrFormat(oValuation.CumulCertifToDate));

        // oModel.setProperty(cxt.getPath() + '/PreviouslyCertified',
        //   this.convertToSAPCurrFormat(oValuation.PreviouslyCertified));
        //    oModel.setProperty(cxt.getPath() + '/Movement',
        //   this.convertToSAPCurrFormat(oValuation.Movement));

        oModel.setProperty(cxt.getPath() + '/CumulInternalValuation',
          this.convertToSAPCurrFormat(oValuation.CumulInternalValuation));

        //   oModel.setProperty(cxt.getPath() + '/PrevInternalValuation',
        //   this.convertToSAPCurrFormat(oValuation.PrevInternalValuation));
        //  oModel.setProperty(cxt.getPath() + '/CurrentMonthValue',
        //   this.convertToSAPCurrFormat(oValuation.CurrentMonthValue));

        oModel.setProperty(cxt.getPath() + '/InterDivCertifDeduction',
          this.convertToSAPCurrFormat(oValuation.InterDivCertifDeduction));

        oModel.setProperty(cxt.getPath() + '/Overclaims',
          this.convertToSAPCurrFormat(oValuation.Overclaims));

        oModel.setProperty(cxt.getPath() + '/Underclaims',
          this.convertToSAPCurrFormat(oValuation.Underclaims));

        oModel.setProperty(cxt.getPath() + '/SundryIncome',
          this.convertToSAPCurrFormat(oValuation.SundryIncome));

      });
    },
    setCostSummaryTableFields(Table) {
      // Get all data from binding instead of just visible rows
      var oBinding = Table.getBinding("rows");
      if (!oBinding) return;

      var aContexts = oBinding.getContexts(0, oBinding.getLength());

      aContexts.forEach((oContext, ind) => {
        if (!oContext) {
          return false;
        }
        var oCost = oContext.getObject();
        //var cxt = e.getParameter('listItem').getBindingContext();
        var oModel = oContext.getModel();

        oModel.setProperty(oContext.getPath() + '/PotentialFinalAccountCost',
          this.convertToSAPCurrFormat(oCost.PotentialFinalAccountCost));
        oModel.setProperty(oContext.getPath() + '/CostToComplete',
          this.convertToSAPCurrFormat(oCost.CostToComplete));
        var Variance = this.getNumber(oCost.RevisedBudget) - this.getNumber(oCost.ProjectedFinalCost);
        var ProjectedFinalCost = this.getNumber(oCost.ActualCostPO) + this.getNumber(oCost.ActualCostSO) + this.getNumber(oCost.CommitedCostPO) + this.getNumber(oCost.CostToComplete);


        oModel.setProperty(oContext.getPath() + '/ProjectedFinalCost',
          this.convertToSAPCurrFormat(ProjectedFinalCost));
        oModel.setProperty(oContext.getPath() + '/Variance',
          this.convertToSAPCurrFormat(Variance));

      });
    },
    setCostItemTableFields(Table) {
      // Get all data from binding instead of just visible rows
      var oBinding = Table.getBinding("rows");
      if (!oBinding) return;

      var aContexts = oBinding.getContexts(0, oBinding.getLength());

      aContexts.forEach((oContext, ind) => {
        if (!oContext) {
          return false;
        }
        var oCost = oContext.getObject();
        //var cxt = e.getParameter('listItem').getBindingContext();
        var oModel = oContext.getModel();

        if (oCost.HierarchyLevel !== 5) {
          return;
        }


        var ProjectedFinalCost = this.getNumber(oCost.ActualCostPO) + this.getNumber(oCost.ActualCostSO) + this.getNumber(oCost.CommitedCostPO) + this.getNumber(oCost.CostToComplete);

        oModel.setProperty(oContext.getPath() + '/ProjectedFinalCost',
          this.convertToSAPCurrFormat(ProjectedFinalCost));
        // oModel.setProperty(cxt.getPath() + '/CostToComplete',
        //   this.convertToSAPCurrFormat(oCost.CostToComplete));
        // oModel.setProperty(cxt.getPath() + '/UnderCost',
        //   this.convertToSAPCurrFormat(oCost.UnderCost));
        // oModel.setProperty(cxt.getPath() + '/OverCost',
        //   this.convertToSAPCurrFormat(oCost.OverCost));

        var Variance = this.getNumber(oCost.RevisedBudget) - this.getNumber(oCost.ProjectedFinalCost);

        oModel.setProperty(oContext.getPath() + '/Variance',
          this.convertToSAPCurrFormat(Variance));

        var MonthsMovement = this.getNumber(oCost.ProjectedFinalCost) - this.getNumber(oCost.PreviousTotalLiability);
        oModel.setProperty(oContext.getPath() + '/MonthsMovement', this.convertToSAPCurrFormat(MonthsMovement));

      });
    },
    cleanupPayload(oData) {

      // Remove all known problematic properties
      var problematicProperties = [
        'to_CostItem', 'WBSLevel6', 'to_Item_oc', 'to_HeaderItem', 'to_Valuation',
        'to_Item', 'to_Valuation_oc', 'to_HeaderItem_oc', 'ProjectInternalID',
        'ProjectQS', 'Delete_mc', 'Update_mc', 'ProjectExternalID', 'WBSElementInternalID',
        '__metadata', 'to_Header', 'ProjectCurrency', 'ClientName', 'CutOffDate',
        'IsLineItemsRequested', 'WBSLevel2Descr', 'WBSLevel3Descr', 'WBSLevel4Descr'
      ];

      problematicProperties.forEach(function (prop) {
        delete oData[prop];
      });

      // Clean up ReportStatus to ensure it's numeric
      if (oData.ReportStatus) {
        oData.ReportStatus = oData.ReportStatus.replace(/\D/g, "");
      }

      // Remove any property that looks like an entity key pattern or contains parentheses
      var keysToDelete = [];
      for (var prop in oData) {
        if (prop.includes('ProjectCostRept(') ||
          prop.includes('HeaderItem(') ||
          prop.includes('Valuation(') ||
          prop.includes('CostDetail(') ||
          prop.includes('CostItem(') ||
          prop.includes('(') ||
          prop.includes(')') ||
          (typeof oData[prop] === 'object' && oData[prop] !== null && !(oData[prop] instanceof Date))) {
          keysToDelete.push(prop);
        }
      }

      // Delete problematic keys
      keysToDelete.forEach(function (key) {
        console.log("Removing problematic property:", key);
        delete oData[key];
      });

      console.log("Cleaned payload keys:", Object.keys(oData));

      return oData;
    },
    convertToSAPCurrFormat(value) {

      var Currency = "AED";
      //var Lang = sap.ui.getCore().getConfiguration().getLanguage();
      var Formatter = sap.ui.core.format.NumberFormat.getCurrencyInstance({
        decimals: 2,
        currency: Currency,
        groupingEnabled: false,
        emptyString: null,
        decimalSeparator: "."
      }
      );
      var oLocale = new sap.ui.core.Locale("en-US");
      //var oFloatFormat = sap.ui.core.format.NumberFormat.getFloatInstance(oLocale);
      value = Formatter.format(this.getNumber(value));
      return value;
    },

    formatDecimal(val) {
      var oNumberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
        maxFractionDigits: 2,
        groupingEnabled: false,
        emptyString: null,
        decimalSeparator: "."
      });
      return oNumberFormat.format(val);
    },
    getNumber(value) {
      if (isNaN(value) || value === null || value === Infinity || value === -Infinity || value === undefined || value === "") {
        return 0;
      }
      return parseFloat(value);

    },
    refreshMetadata: function () {
      var oModel = this.getModel();
      if (oModel && oModel.refreshMetadata) {
        oModel.refreshMetadata();
      } else if (oModel && oModel.getMetaModel && oModel.getMetaModel().refresh) {
        oModel.getMetaModel().refresh();
      } else {
        console.warn("Metadata refresh not supported for this model.");
      }
    },

    showBusyUntilAllLoaded: function (UIControls, Models) {
      var components = [
        UIControls.HeaderSmartForm,
        UIControls.HeaderItemTable,
        UIControls.ValuationTable,
        UIControls.CostSummaryTable,
        UIControls.CostItemTable
      ].filter(function (ctrl) {
        return ctrl && ctrl.getVisible && ctrl.getVisible();
      });

      var loadedCount = 0;
      var total = components.length;
      var that = this;

      // Show skeleton screen instead of busy indicator
      this.showSkeletonScreen(true);

      var onLoaded = function () {
        loadedCount++;
        if (loadedCount === total) {

          try {
            var oBinding = UIControls.CostSummaryTable.getBinding("rows");
            var iRowCount = oBinding.getLength();
            if (iRowCount) {
              //UIControls.CostSummaryTable.setVisibleRowCount(iRowCount);
            }
          } catch (error) { }

          try {
            oBinding = UIControls.CostItemTable.getBinding("rows");
            iRowCount = oBinding.getLength();
            if (iRowCount) {
              //UIControls.CostItemTable.setVisibleRowCount(iRowCount);
            }
          } catch (error) { }

          var oTable = that.getCostTable(UIControls);
          if (oTable === UIControls.CostSummaryTable) {
            that.getModel().read("/ActualCost(p_project='" +
              that.Project + "',p_date='" +
              that.formatDateToYYYYmmDD(that.CutOffDate) + "')/Set", {
              success: function (oData) {

                if (oData) {
                  that.setActualPOCost(
                    that.getCostTable(UIControls),
                    oData.results
                  );

                  // Hide skeleton screen
                  that.showSkeletonScreen(false);
                  //that.refreshTable(that.getCostTable(UIControls));

                }

                that.calculateTableTotals(oTable);

              },
              error: function (oError) {
                // Hide skeleton screen on error
                that.showSkeletonScreen(false);
              }
            });
          }

          if (oTable === UIControls.CostItemTable) {
            that.getModel().read("/ActualCostItem(p_project='" +
              that.Project + "',p_date='" +
              that.formatDateToYYYYmmDD(that.CutOffDate) + "')/Set", {
              success: function (oData) {

                if (oData) {
                  that.setActualCostItem(
                    that.getCostTable(UIControls),
                    oData.results
                  );

                  // Hide skeleton screen
                  that.showSkeletonScreen(false);

                  that.calculateTableTotals(oTable);
                  //that.refreshTable(that.getCostTable(UIControls));

                }
              },
              error: function (oError) {
                // Hide skeleton screen on error
                that.showSkeletonScreen(false);
              }
            });
          }
        }
      };

      components.forEach(function (ctrl) {
        var oBinding = ctrl.getBinding("rows") || ctrl.getBinding("items") || ctrl.getBinding("elements");
        if (oBinding) {
          oBinding.attachEventOnce("dataReceived", onLoaded);
        }
        // Always listen for context change (for forms)
        ctrl.attachEventOnce("modelContextChange", onLoaded);
      });

      // Fallback: hide skeleton screen after 20 seconds if not all events fire
      setTimeout(function () {
        that.showSkeletonScreen(false);
      }, 20000);
    },

    showSkeletonScreen: function (show) {
      var oView = this.getView();
      if (!oView) {
        console.warn("View not available for skeleton screen");
        // Fallback to global busy indicator
        if (show) {
          sap.ui.core.BusyIndicator.show(0);
        } else {
          sap.ui.core.BusyIndicator.hide();
        }
        return;
      }

      // Try to find the current page - try multiple possible IDs
      var oPage = oView.byId("page") || oView.byId("createPage") || oView.byId("changePage") || oView.byId("displayPage");

      if (!oPage) {
        // Try to find any page element
        var aPages = oView.findAggregatedObjects(true, function (oControl) {
          return oControl.getMetadata().getName() === "sap.m.Page";
        });
        if (aPages.length > 0) {
          oPage = aPages[0];
        }
      }

      // Find ObjectPageLayout if available
      var oObjectPageLayout = oView.byId("ObjectPageLayout");
      var oTargetControl = oObjectPageLayout || oPage;

      if (!oTargetControl) {
        console.warn("No target control found, using global busy indicator");
        if (show) {
          sap.ui.core.BusyIndicator.show(0);
        } else {
          sap.ui.core.BusyIndicator.hide();
        }
        return;
      }

      // Apply CSS classes to prevent SmartForm flicker
      var oPageDomRef = oPage.getDomRef();
      if (oPageDomRef) {
        if (show) {
          oPageDomRef.classList.add("smartFormLoading");
          oPageDomRef.classList.remove("smartFormLoaded");
        } else {
          oPageDomRef.classList.remove("smartFormLoading");
          oPageDomRef.classList.add("smartFormLoaded");
        }
      }

      // Use the control's built-in busy indicator functionality
      if (show) {
        oTargetControl.setBusy(true);
        oTargetControl.setBusyIndicatorDelay(0);

        // Additionally show skeleton content if we can
        if (!this._skeletonShown && oPage) {
          try {
            if (!this._oSkeletonLoader) {
              this._oSkeletonLoader = sap.ui.xmlfragment("com.atg.ppm.postfinrevenue.view.fragment.SkeletonLoader", this);
              oView.addDependent(this._oSkeletonLoader);

              // Create overlay container
              this._oSkeletonOverlay = new sap.m.VBox({
                width: "100%",
                height: "100%",
                backgroundDesign: "Solid",
                items: [this._oSkeletonLoader]
              }).addStyleClass("skeletonOverlay");

              oView.addDependent(this._oSkeletonOverlay);
            }

            oPage.addContent(this._oSkeletonOverlay);
            this._oSkeletonOverlay.setVisible(true);
            this._skeletonShown = true;
          } catch (e) {
            console.warn("Could not show skeleton overlay:", e);
          }
        }

      } else {
        oTargetControl.setBusy(false);

        // Hide skeleton overlay
        if (this._skeletonShown && this._oSkeletonOverlay && oPage) {
          try {
            this._oSkeletonOverlay.setVisible(false);
            oPage.removeContent(this._oSkeletonOverlay);
            this._skeletonShown = false;
          } catch (e) {
            console.warn("Could not hide skeleton overlay:", e);
          }
        }

        // Ensure global busy indicator is also hidden
        sap.ui.core.BusyIndicator.hide();
      }
    },
    setActualPOCost(Table, aActualPOCost) {
      // Get all data from binding instead of just visible rows
      var oBinding = Table.getBinding("rows");
      if (!oBinding) return;

      var aContexts = oBinding.getContexts(0, oBinding.getLength());

      aContexts.forEach((oContext, ind) => {
        if (!oContext) {
          return false;
        }
        var oData = oContext.getObject();
        var oModel = oContext.getModel();
        if (oData.HierarchyLevel === 6) {
          return false;
        }
        var ActualCostPO = 0;
        var ActualCostSO = 0;

        aActualPOCost.forEach((POCost, ind) => {
          if (oData.WBSLevel2 === POCost.WBSElement ||
            oData.WBSLevel3 === POCost.WBSElement ||
            oData.WBSLevel4 === POCost.WBSElement
          ) {
            ActualCostPO = POCost.ActualCostPO;
            ActualCostSO = POCost.ActualCostSO;
            return false;
          }
        })

        oModel.setProperty(oContext.getPath() + '/ActualCostPO',
          this.convertToSAPCurrFormat(ActualCostPO));
        oModel.setProperty(oContext.getPath() + '/ActualCostSO',
          this.convertToSAPCurrFormat(ActualCostSO));
        ActualCostPO = 0;
        ActualCostSO = 0;

      });
    },
    setActualCostItem(Table, aActualCost) {
      // Get all data from binding instead of just visible rows
      var oBinding = Table.getBinding("rows");
      if (!oBinding) return;

      var aContexts = oBinding.getContexts(0, oBinding.getLength());

      aContexts.forEach((oContext, ind) => {
        if (!oContext) {
          return false;
        }
        var oData = oContext.getObject();
        var oModel = oContext.getModel();
        if (oData.HierarchyLevel === 6) {
          return false;
        }
        var ActualCostPO = 0;
        var ActualCostSO = 0;

        aActualCost.forEach((ActCost, ind) => {
          if (oData.WBSLevel2 === ActCost.WBSElement ||
            oData.WBSLevel3 === ActCost.WBSElement ||
            oData.WBSLevel4 === ActCost.WBSElement
          ) {
            if (ActCost.PurchaseOrder === oData.PONumber) {
              ActualCostPO = ActCost.ActualCostPO;
              ActualCostSO = ActCost.ActualCostSO;
              return false;
            }
          }
        })

        oModel.setProperty(oContext.getPath() + '/ActualCostPO',
          this.convertToSAPCurrFormat(ActualCostPO));
        oModel.setProperty(oContext.getPath() + '/ActualCostSO',
          this.convertToSAPCurrFormat(ActualCostSO));
        ActualCostPO = 0;
        ActualCostSO = 0;

      });
    },
    formatDateToYYYYmmDD(date) {
      if (!date)
        date = new Date();

      var yyyy = date.getFullYear();
      var mm = String(date.getMonth() + 1).padStart(2, '0');
      var dd = String(date.getDate()).padStart(2, '0');
      return yyyy + mm + dd;
    },
    enableDisplayMode(Models) {
      Models.ViewControl.setProperty('/Mode/IsUpdate', false);
      Models.ViewControl.setProperty('/Mode/IsCreate', false);
      Models.ViewControl.setProperty('/Mode/IsEditable', false);
      //Models.ViewControl.setProperty("/Sections/IsVisible", true);

      Models.ViewControl.setProperty("/SmartField/ReportStatus", false);
      Models.ViewControl.setProperty("/SmartField/RevisedCompletionDate", false);
      Models.ViewControl.setProperty("/SmartField/DelayInDays", false);
      Models.ViewControl.setProperty("/SmartField/ReportingMonth", false);
      Models.ViewControl.setProperty("/SmartField/ValuationDate", false);
      Models.ViewControl.setProperty("/SmartField/MainContractCurrentSell", false);
      Models.ViewControl.setProperty("/SmartField/TenderMarginOnRevenue", false);
      Models.ViewControl.setProperty("/SmartField/TenderMarginCombined_F", false);
      Models.ViewControl.setProperty("/SmartField/AprvVariationCurrentSell", false);
      Models.ViewControl.setProperty("/SmartField/UnaprvVariationCurrentSell", false);
      Models.ViewControl.setProperty("/SmartField/ProjFinalAccountCurrentSell", false);
      Models.ViewControl.setProperty("/SmartField/PotFinalAccountCurrentSell", false);
      Models.ViewControl.setProperty("/SmartField/TenderMarginTurnkey_F", false);
      Models.ViewControl.setProperty("/SmartField/TenderMarginJoinery_F", false);
      Models.ViewControl.setProperty("/SmartField/Remarks", false);
      Models.ViewControl.setProperty("/SmartField/TurnkeyTenderValue", false);
      Models.ViewControl.setProperty("/SmartField/JoineryTenderValue", false);

      // Force currency elements to be visible after switching to display mode
      this.ensureCurrencyVisibility();
    },

    ensureCurrencyVisibility: function () {
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        try {
          var oView = this.getView();
          if (!oView) return;

          // Find all currency suffix elements and force them to be visible
          var $currencyElements = oView.$().find('.currencySuffix-header');

          $currencyElements.each(function () {
            var $element = jQuery(this);

            // Force CSS properties to ensure visibility
            $element.css({
              'display': 'inline-block !important',
              'visibility': 'visible !important',
              'opacity': '1 !important',
              'position': 'relative',
              'z-index': '1'
            });

            // Ensure the element is not hidden
            $element.show();

            // Add a class to mark as processed
            $element.addClass('currency-visible');
          });

          console.log("Currency visibility ensured for", $currencyElements.length, "elements");

        } catch (e) {
          console.warn("Could not ensure currency visibility:", e);
        }
      }, 200);
    },
    enableChangeMode(Models) {
      Models.ViewControl.setProperty('/Mode/IsUpdate', true);
      Models.ViewControl.setProperty('/Mode/IsCreate', false);
      Models.ViewControl.setProperty('/Mode/IsEditable', true);

      Models.ViewControl.setProperty("/SmartField/ReportStatus", true);
      Models.ViewControl.setProperty("/SmartField/RevisedCompletionDate", true);
      Models.ViewControl.setProperty("/SmartField/DelayInDays", true);
      Models.ViewControl.setProperty("/SmartField/ReportingMonth", true);
      Models.ViewControl.setProperty("/SmartField/ValuationDate", true);
      Models.ViewControl.setProperty("/SmartField/MainContractCurrentSell", true);
      Models.ViewControl.setProperty("/SmartField/TenderMarginOnRevenue", true);
      Models.ViewControl.setProperty("/SmartField/TenderMarginCombined_F", true);
      Models.ViewControl.setProperty("/SmartField/AprvVariationCurrentSell", true);
      Models.ViewControl.setProperty("/SmartField/UnaprvVariationCurrentSell", true);
      Models.ViewControl.setProperty("/SmartField/ProjFinalAccountCurrentSell", true);
      Models.ViewControl.setProperty("/SmartField/PotFinalAccountCurrentSell", true);
      Models.ViewControl.setProperty("/SmartField/TenderMarginTurnkey_F", true);
      Models.ViewControl.setProperty("/SmartField/TenderMarginJoinery_F", true);
      Models.ViewControl.setProperty("/SmartField/Remarks", true);
      Models.ViewControl.setProperty("/SmartField/TurnkeyTenderValue", true);
      Models.ViewControl.setProperty("/SmartField/JoineryTenderValue", true);

    },
    set(UIControls) {

    },
    calcProjFinalAccountCurrentSell(oEvent) {

      var oContext = this.UIControls.HeaderSmartForm.getBindingContext();
      var oData = oContext.getObject();

      var ProjFinalAccountCurrentSell = this.getNumber(oData.MainContractCurrentSell) +
        this.getNumber(oData.AprvVariationCurrentSell) -
        this.getNumber(oData.UnaprvVariationCurrentSell);

      if (ProjFinalAccountCurrentSell === 0) {
        ProjFinalAccountCurrentSell = oData.MainContractCurrentSell;
      }


      this.getModel().setProperty(oContext.getPath() + '/ProjFinalAccountCurrentSell',
        this.convertToSAPCurrFormat(ProjFinalAccountCurrentSell));

      //this.refreshTable(this.UIControls.HeaderItemTable);
    },
    onHITablePersonalizePress: function () {
      this._oHITablePersoController.openDialog();
    },
    onValuationTablePersonalizePress: function () {
      this._oValuationTablePersoController.openDialog();
    },
    onCostDetailTablePersonalizePress: function () {
      this._oCostDetailTablePersoController.openDialog();
    },
    onCostItemTablePersonalizePress: function () {
      this._oCostItemTablePersoController.openDialog();
    },
    onTableRowsUpdated: function (oEvent) {
      // Get the table that triggered the event
      var oTable = oEvent.getSource();
      var sTableId = oTable.getId();

    },
    onUpdateFinished(oEvent) {
      var oTable = oEvent.getSource();
      // this.refreshTable(oTable);
    },
    refreshTable(oTable, property) {

      var UIControls = this.UIControls;
      //UIControls.HeaderItemTable.getColumns()[0].setFooter(new sap.m.Label({ text: 100 }));

      // UIControls.ValuationTable.getColumns()[0].setFooter(new sap.m.Label({ text: 100 }));
      if (oTable === UIControls.CostSummaryTable) {
        this.setCostSummaryTableFields(UIControls.CostSummaryTable);
        this.calculateTableTotals(UIControls.CostSummaryTable, property);

      }
      if (oTable === UIControls.CostItemTable) {
        this.setCostItemTableFields(UIControls.CostItemTable);
        this.calculateTableTotals(UIControls.CostItemTable, property);
      }
      if (oTable === UIControls.HeaderItemTable) {

        this.setHeaderItemTableFields(UIControls.HeaderSmartForm, UIControls.HeaderItemTable, UIControls.ValuationTable, this.getCostTable(UIControls));
        this.generateTotalFooter(UIControls.HeaderItemTable);
        this.formatHeaderItemTable(UIControls.HeaderItemTable);
      }
      if (oTable === UIControls.ValuationTable) {

        this.setValuationTableFields(UIControls.ValuationTable);
        this.generateTotalFooter(UIControls.ValuationTable);
        this.formatValuationTable(UIControls.ValuationTable);
      }
    },

    onCurrencyInputChange: function (oEvent) {
      var oInput = oEvent.getSource();
      var oRow = oInput.getParent(); // Usually the row
      var oTable = oRow.getParent(); // Usually the table

      // Get the table ID
      var sTableId = oTable.getId();
      console.log("Table ID:", sTableId);

      var sValue = oInput.getValue();
      var fValue = parseFloat(sValue);
      // Validate: must be a number and >= 0
      if (isNaN(fValue)) {
        oInput.setValueState("Error");
        oInput.setValueStateText("Please enter a valid amount.");
      } else {
        oInput.setValueState("None");
        var oBindingInfo = oInput.getBindingInfo("value");
        var oContext = oInput.getBindingContext();

        var property = oBindingInfo.parts[0].path;
        var oModel = oContext.getModel();
        var value = oModel.getProperty(oContext.getPath() + "/" + property);

        oModel.setProperty(oContext.getPath() + '/' + property,
          this.convertToSAPCurrFormat(value));

        if (property === 'ForecastFinalValue') {
          this.bInputForecastFinalValue = true;
        }

        //this.refreshTable(oTable, property);

        //MessageToast.show("Values Updated");

        //var cxt = e.getParameter('listItem').getBindingContext();
      }
    },

    formatStatusIcon: function (status) {
      switch (status) {
        case "1": // Create
          return "sap-icon://create";
        case "2": // In Review
          return "sap-icon://pending";
        case "3": // Reviewed
          return "sap-icon://review";
        case "4": // Approved
          return "sap-icon://accept";
        case "5": // Rejected
          return "sap-icon://decline";
        case "6": // Deleted
          return "sap-icon://delete";
        default:
          return "sap-icon://document";
      }
    },

    formatStatusColor: function (status) {
      switch (status) {
        case "1": // Create
          return "#0070f2"; // Blue
        case "2": // In Review
          return "#e9730c"; // Orange
        case "3": // Reviewed
          return "#2196f3"; // Light Blue
        case "4": // Approved
          return "#30914c"; // Green
        case "5": // Rejected
          return "#bb0000"; // Red
        case "6": // Deleted
          return "#666666"; // Gray
        default:
          return "#666666"; // Default Gray
      }
    },
    setHeaderSmartFormProperties() {
      var oModel = this.getModel();
      var oContext = this.UIControls.HeaderSmartForm.getBindingContext();
      if (!oContext) return;

      // Calculate DelayInDays
      this.calculateDelayInDays();

      // Set properties for Header Smart Form
      var oCostTable = this.getCostTable(this.UIControls);
      if (oCostTable) {
        var oBinding = oCostTable.getBinding("rows");
        if (oBinding) {
          var aContexts = oBinding.getContexts(0, oBinding.getLength());

          // Find the first HierarchyLevel 6 row for Joinery and Turnkey
          var joineryRow = aContexts.find(function (ctx) {
            var obj = ctx && ctx.getObject ? ctx.getObject() : null;
            return obj && obj.HierarchyLevel === 6 && obj.ProjectType === "AJ";
          });
          var turnkeyRow = aContexts.find(function (ctx) {
            var obj = ctx && ctx.getObject ? ctx.getObject() : null;
            return obj && obj.HierarchyLevel === 6 && obj.ProjectType === "AT";
          });

          // Set JoineryTenderValue and TurnkeyTenderValue from the found rows
          if (joineryRow && joineryRow.getObject) {
            var joineryValue = joineryRow.getObject().TenderCost;
            var JoineryTenderValue = oContext.getObject().JoineryTenderValue;
            if (JoineryTenderValue && joineryValue) {
              var joineryMargin = ((JoineryTenderValue - joineryValue) / JoineryTenderValue) * 100;
              joineryMargin = Math.round(joineryMargin * 100) / 100; // Round to two decimals
              joineryMargin = this.convertToSAPCurrFormat(this.getNumber(joineryMargin));
              oModel.setProperty(oContext.getPath() + '/TenderMarginJoinery_F',
                joineryMargin);
            }
          }
          if (turnkeyRow && turnkeyRow.getObject) {
            var turnkeyValue = turnkeyRow.getObject().TenderCost;
            var TurnkeyTenderValue = oContext.getObject().TurnkeyTenderValue;
            if (TurnkeyTenderValue && turnkeyValue) {
              var turnkeyMargin = ((TurnkeyTenderValue - turnkeyValue) / TurnkeyTenderValue) * 100;
              turnkeyMargin = Math.round(turnkeyMargin * 100) / 100; // Round to two decimals
              turnkeyMargin = this.convertToSAPCurrFormat(this.getNumber(turnkeyMargin));
              oModel.setProperty(oContext.getPath() + '/TenderMarginTurnkey_F',
                turnkeyMargin);
            }
          }
        }

      }
    },

    calculateDelayInDays: function () {
      var oContext = this.UIControls.HeaderSmartForm.getBindingContext();
      if (!oContext) return;

      var oData = oContext.getObject();
      var oModel = oContext.getModel();

      var requestedDeliveryDate = oData.RequestedDeliveryDate;
      var revisedCompletionDate = oData.RevisedCompletionDate;

      if (requestedDeliveryDate && revisedCompletionDate) {
        try {
          // Ensure dates are Date objects
          var dRequestedDelivery = new Date(requestedDeliveryDate);
          var dRevisedCompletion = new Date(revisedCompletionDate);

          // Validate dates are valid
          if (isNaN(dRequestedDelivery.getTime()) || isNaN(dRevisedCompletion.getTime())) {
            console.warn("Invalid dates for DelayInDays calculation");
            oModel.setProperty(oContext.getPath() + '/DelayInDays', 0);
            return;
          }

          // Calculate difference in milliseconds, then convert to days
          var timeDiff = dRevisedCompletion.getTime() - dRequestedDelivery.getTime();
          var daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

          // Update the DelayInDays field - ensure it's an integer for Int32 SmartField
          oModel.setProperty(oContext.getPath() + '/DelayInDays', daysDiff);
        } catch (e) {
          console.error("Error calculating DelayInDays:", e);
          oModel.setProperty(oContext.getPath() + '/DelayInDays', 0);
        }
      } else {
        // Set to 0 if either date is missing
        oModel.setProperty(oContext.getPath() + '/DelayInDays', 0);
      }
    },

    onDateChange: function (oEvent) {
      // Recalculate DelayInDays when either date field changes
      this.calculateDelayInDays();
    },

    formatDateForURL: function (date) {
      if (!date) return "";
      var d = new Date(date);
      return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, '0') + "-" +
        String(d.getDate()).padStart(2, '0');
    },

    onCostSummaryTableFullScreen: function () {
      if (!this._oCostSummaryDialog) {
        this._oCostSummaryDialog = sap.ui.xmlfragment("com.atg.ppm.postfinrevenue.view.fragment.CostSummaryDialog", this);
        this.getView().addDependent(this._oCostSummaryDialog);
      }
      
      // Clone the table's binding context to the dialog
      var oTable = this.UIControls.CostSummaryTable;
      if (oTable && oTable.getBindingContext()) {
        this._oCostSummaryDialog.setBindingContext(oTable.getBindingContext());
      }
      
      this._oCostSummaryDialog.open();
    },

    onCloseCostSummaryDialog: function () {
      if (this._oCostSummaryDialog) {
        this._oCostSummaryDialog.close();
      }
    },

    onRefreshCostSummaryDialog: function () {
      if (this._oCostSummaryDialog) {
        // Find the table within the dialog
        // Structure: Dialog -> VBox -> Table
        var aContent = this._oCostSummaryDialog.getContent();
        if (aContent && aContent.length > 0) {
          var oVBox = aContent[0];
          if (oVBox && oVBox.getItems) {
            var aItems = oVBox.getItems();
            if (aItems && aItems.length > 0) {
              var oTable = aItems[0];
              if (oTable && oTable.isA("sap.ui.table.Table")) {
                // Apply the same logic as CostSummaryTable
                this.setCostSummaryTableFields(oTable);
                this.calculateTableTotals(oTable);
                sap.m.MessageToast.show("Values Updated");
              }
            }
          }
        }
      }
    }



  });
});