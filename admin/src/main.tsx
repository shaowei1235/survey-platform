import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, App as AntdApp } from "antd";
import jaJP from "antd/locale/ja_JP";
import { App } from "./App";
import "./i18n";
import { store } from "./store";
import { appTheme } from "./theme";
import "./index.css";

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ConfigProvider locale={jaJP} theme={appTheme}>
        <AntdApp>
          <BrowserRouter basename={routerBasename}>
            <App />
          </BrowserRouter>
        </AntdApp>
      </ConfigProvider>
    </Provider>
  </React.StrictMode>,
);
