sap.ui.define([
    "./ui5-CustomClass/Base/BaseController",
    "./ui5-CustomClass/Unit/FilterBarUnit",
    "./ui5-CustomClass/Control/Downloader",
    "./ui5-CustomClass/Model/CustomODataModel"
], function (
    BaseController,
    FilterBarUnit,
    Downloader,
    CustomODataModel
) {
    "use strict";

    return BaseController.extend("com.aspn.tools.ybcpi0040.controller.View1", {

        /**
         * @override
         */
        _registerModel() {
            this.setmodel("fcl", {
                layout: "OneColumn"
            });
            const oCustomODataModel = new CustomODataModel("/sap/bc/http/sap/ybcpi_proxy/");
            this.setmodel("http", oCustomODataModel);
        },
        /**
         * @override
         */
        _onInit() {
            this.onFilterBarSearch();
            // this.byId("idFilterBar").setBasicSearch(new sap.m.SearchField({
            //     placeholder: "Search...",
            //     liveChange: this.onSearchFieldLiveChange
            // }));
        },

        onFilterBarSearch: async function () {
            var oFilterBar = this.byId("idFilterBar");
            const oHttpModel = this.getmodel("http");

            //filterbar控件上的filter转换成sap.ui.model.Filter
            var aPackageFilters = FilterBarUnit.Filters_form_Names(oFilterBar, ["Id"]);
            var aResourceFilters = FilterBarUnit.Filters_form_Names(oFilterBar, ["ResourceType"]);

            this.byId("idTable").setBusy(true);
            try {
                //var oTableData = await this.getmodeldata("CPI", "/IntegrationPackages");
                var oTableData = await oHttpModel.GET(
                    "/IntegrationPackages",
                    {
                        urlParameters: { "$format": "json" }
                    }
                );

                oTableData = oTableData.map((item) => {
                    return {
                        Id: item.Id,
                        Name: item.Name
                    };
                });

                if (oTableData.length === 0) {
                    this.setmodel("tableData");
                    this.byId("idTable").setBusy(false);
                    await this.MessageBox().error("No data found.");
                    return;
                }

                let tabledata = [];
                await Promise.all(oTableData.map(async (item) => {
                    let oDate = await oHttpModel.GET(
                        `/IntegrationPackages('${item.Id}')/ScriptCollectionDesigntimeArtifacts`,
                        {
                            urlParameters: { "$format": "json" }
                        }
                    );
                    item.SCDA = oDate?.[0];
                    if (!item.SCDA) { return; }
                    var oResourcesDate = await this.odata2.GET(
                        "CPI",
                        `/ScriptCollectionDesigntimeArtifacts(Id='${item.SCDA.Id}',Version='${item.SCDA.Version}')/Resources`,
                        {},
                        aResourceFilters
                    );
                    oResourcesDate.forEach(i => {
                        item.Resource = i;
                        tabledata.push(JSON.parse(JSON.stringify(item)));
                    });
                    return Promise.resolve();
                }));

                if (aPackageFilters.length > 0) {
                    oTableData = tabledata.filter(item => aPackageFilters.some(filter => item.Id === filter.oValue1));
                } else {
                    oTableData = tabledata;
                }

                if (oTableData.length === 0) {
                    this.setmodel("tableData");
                    this.byId("idTable").setBusy(false);
                    await this.MessageBox().error("No data found.");
                    return;
                }

                this.setmodel("tableData", oTableData);
                //在table渲染完后
                setTimeout(() => {
                    // 自动调整宽度
                    this.__autoWidthTable(this.byId("idTable"));
                }, 0);
                this.byId("idTable").setBusy(false);
            } catch (error) {
                console.error(error);

                this.byId("idTable").setBusy(false);
            }
        },

        async onDownloadButtonPress(oEvent) {
            const oTable = this.byId("idTable");
            const aSelectedIndex = oTable.getSelectedIndices();
            if (aSelectedIndex.length === 0) {
                await this.MessageBox().error("Please select the row to download");
                return;
            }

            oTable.setBusy(true);
            const oDownloader = new Downloader();
            for (const index of aSelectedIndex) {
                let oContext = oTable.getContextByIndex(index);
                let oSelectedData = oContext.getObject();
                if (!oSelectedData.SCDA) { continue; }
                const downloadUrl = `${window.location.origin}/sap/bc/http/sap/ybcpi_proxy`
                    + `/ScriptCollectionDesigntimeArtifacts(Id='${oSelectedData.SCDA.Id}',Version='${oSelectedData.SCDA.Version}')`
                    + "/$value";

                oDownloader.download(downloadUrl);
            }
            oTable.setBusy(false);
        },

        async onSaveAsVersionButtonPress(oEvent) {
            const oTable = this.byId("idTable");
            const aSelectedIndex = oTable.getSelectedIndices();
            if (aSelectedIndex.length === 0) {
                await this.MessageBox().error("Please select the row to save as version");
                return;
            }
            oTable.setBusy(true);
            for (const index of aSelectedIndex) {
                let oContext = oTable.getContextByIndex(index);
                let oSelectedData = oContext.getObject();

                if (oSelectedData.SCDA.Version === "Active") {
                    sap.m.MessageToast.show("Active version cannot be saved as version.");
                    continue;
                }

                let oSave = await this.getmodel("http").POST(
                    "/ScriptCollectionDesigntimeArtifactSaveAsVersion",
                    {},
                    {
                        urlParameters: {
                            Id: `'${oSelectedData.SCDA.Id}'`,
                            SaveAsVersion: `'${oSelectedData.SCDA.Version}'`
                        }
                    }
                );

                const messages = {
                    "400": "Script Collection with invalid version.",
                    "403": "Access forbidden - you did not have the required permissions to access the resource.",
                    "404": "Script collection design time artifact not found (invalid Id).",
                    "200": "Success"
                };

                const message = oSave.error ? oSave.error.message : messages[oSave.status];
                sap.m.MessageToast.show(message);
            }
            oTable.setBusy(false);
        },

        async onDeployButtonPress(oEvent) {
            const oTable = this.byId("idTable");
            const aSelectedIndex = oTable.getSelectedIndices();
            if (aSelectedIndex.length === 0) {
                await this.MessageBox().error("Please select the row to deploy");
                return;
            }

            oTable.setBusy(true);
            for (const index of aSelectedIndex) {
                let oContext = oTable.getContextByIndex(index);
                let oSelectedData = oContext.getObject();
                let oDeploy = await this.getmodel("http").POST(
                    "/DeployScriptCollectionDesigntimeArtifact",
                    {},
                    {
                        urlParameters: {
                            Id: `'${oSelectedData.SCDA.Id}'`,
                            Version: `'${oSelectedData.SCDA.Version}'`
                        }
                    }
                );
                var message;
                if (oDeploy.statusCode) {
                    const messages = {
                        "202": "Deployment triggered for script collection artifact. Response contains task Id.",
                        "400": "Bad request - wrong Id or version or single quotes are missing.",
                        "403": "Access forbidden - you did not have the required permissions to access the resource.",
                        "500": "Internal server error",
                        "200": "Success"
                    };

                    message = oDeploy.error ? oDeploy.error.message : messages[oDeploy.status];
                } else {
                    message = "Success";
                }

                sap.m.MessageToast.show(message);
            }
            oTable.setBusy(false);
        },

        async onNameLinkPress(oEvent) {
            this.byId("idFlexibleColumnLayout").setBusy(true);
            const oContext = oEvent.getSource().getBindingContext("tableData");
            const oRow = oContext.getObject();
            this.setmodel("DetailData", oRow);

            const sCode = await this.getmodel("http").GET(
                `/ScriptCollectionDesigntimeArtifacts(Id='${oRow.SCDA.Id}',Version='${oRow.SCDA.Version}')`
                + `/Resources(Name='${oRow.Resource.Name}',ResourceType='${oRow.Resource.ResourceType}')/$value`
            );
            this.setmodelproperty("DetailData", "/Code", sCode);
            this.setmodelproperty("fcl", "/layout", "TwoColumnsMidExpanded");
            this.byId("idFlexibleColumnLayout").setBusy(false);
        },

        onOverflowToolbarButtonFullPress(oEvent) {
            this.setmodelproperty("fcl", "/layout", "MidColumnFullScreen");
        },

        onOverflowToolbarButtonExitPress(oEvent) {
            this.setmodelproperty("fcl", "/layout", "TwoColumnsMidExpanded");
        },

        onOverflowToolbarButtonClosePress(oEvent) {
            this.setmodel("DetailData");
            this.setmodelproperty("fcl", "/layout", "OneColumn");
        },

        async onSaveButtonPress(oEvent) {
            const oCodeEditor = this.byId("idCodeCodeEditor");
            oCodeEditor.setBusy(true);
            this.getmodel("CPI").setUseBatch(false);

            const oData = await this.getmodeldata("DetailData");
            var message;

            const oReq = await this.odata2.PUT(
                "CPI",
                `/ScriptCollectionDesigntimeArtifacts(Id='${oData.SCDA.Id}',Version='${oData.SCDA.Version}')`
                + "/$links"
                + `/Resources(Name='${oData.Resource.Name}',ResourceType='${oData.Resource.ResourceType}')`,
                {
                    ResourceContent: btoa(oData.Code) //要求编码格式为base64url使用btoa内置方法转换
                }
            );

            const saveMessage = {
                "202": "Update triggered for resource.",
                "400": "Bad request - resource with the given name/type does not exist.",
                "403": "Access forbidden - you did not have the required permissions to access the resource.",
                "404": "Not found - script collection with given Id and version does not exist.",
                "500": "Internal server error - possibly invalid resource content."
            };

            if (oReq.statusCode && oReq.statusCode !== 200) {
                message = saveMessage[oReq.statusCode] || "Unknown Error";
                sap.m.MessageToast.show("Save Error:" + message);
                oCodeEditor.setBusy(false);
                return;
            }

            if (oData.SCDA.Version !== "Active") {
                const oSAVReq = await this.odata2.POST(
                    "CPI",
                    "/ScriptCollectionDesigntimeArtifactSaveAsVersion",
                    {},
                    {
                        Id: `'${oData.SCDA.Id}'`,
                        SaveAsVersion: `'${oData.SCDA.Version}'`
                    }
                );

                const oSAVMessages = {
                    "400": "Script Collection with invalid version.",
                    "403": "Access forbidden - you did not have the required permissions to access the resource.",
                    "404": "Script collection design time artifact not found (invalid Id)."
                };

                if (oSAVReq.statusCode !== 200) {
                    message = oSAVMessages[oSAVReq.statusCode] || "Unknown Error";
                    sap.m.MessageToast.show("Save As Version Error:" + message);
                    oCodeEditor.setBusy(false);
                    return;
                }
            }

            const deployReq = await this.odata2.POST(
                "CPI",
                "/DeployScriptCollectionDesigntimeArtifact",
                {},
                {
                    Id: `'${oData.SCDA.Id}'`,
                    Version: `'${oData.SCDA.Version}'`
                }
            );

            const deployMessages = {
                "202": "Deployment triggered for script collection artifact. Response contains task Id.",
                "400": "Bad request - wrong Id or version or single quotes are missing.",
                "403": "Access forbidden - you did not have the required permissions to access the resource.",
                "500": "Internal server error"
            };

            if (deployReq.statusCode && deployReq.statusCode !== 200) {
                message = deployMessages[deployReq.statusCode] || "Unknown Error";
                sap.m.MessageToast.show("Deploy Error:" + message);
                oCodeEditor.setBusy(false);
                return;
            }

            sap.m.MessageToast.show("Save Successful");

            this.getmodel("CPI").setUseBatch(true);
            this.byId("idCodeCodeEditor").setBusy(false);
        },

        onFilterBarClear(oEvent) {
            var oFilterBar = oEvent.getSource();
            var aFilterItems = oFilterBar.getFilterGroupItems();

            aFilterItems.forEach(item => {
                var itemcontrol = item.getControl();
                switch (itemcontrol.getMetadata().getName()) {
                    case "sap.m.MultiInput":
                        itemcontrol.setTokens([]);
                        break;
                    case "sap.m.Select":
                        itemcontrol.setSelectedKey("");
                        break;
                    case "sap.m.SearchField":
                        itemcontrol.setValue("");
                        break;
                    default:
                        break;
                }
            });
        },

        onSearchFieldLiveChange: function (oEvent) {
            var aFilters = [];
            var sQuery = oEvent.getSource().getValue();
            if (sQuery && sQuery.length > 0) {
                aFilters.push(new sap.ui.model.Filter("Name", "Contains", sQuery));
                aFilters.push(new sap.ui.model.Filter("SCDA/Description", "Contains", sQuery));
                aFilters.push(new sap.ui.model.Filter("Resource/Name", "Contains", sQuery));
            }

            var oList = this.byId("idTable");
            var oBinding = oList.getBinding("rows");
            if (aFilters.length > 0) {
                oBinding.filter(new sap.ui.model.Filter({
                    filters: aFilters,
                    and: false
                }));
            } else {
                oBinding.filter([]);
            }
        },

        onTrueButtonPress(oEvent) {
            this.setmodel("ui", { condition: false });
        },

        onFalseButtonPress(oEvent) {
            this.setmodel("ui", { condition: true });
        }

    });
});
