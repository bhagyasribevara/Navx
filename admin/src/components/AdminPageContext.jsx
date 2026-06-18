import React, { createContext, useContext, useState } from 'react';

const AdminPageContext = createContext();

export function AdminPageProvider({ children }) {
  const [pageContext, setPageContext] = useState({
    pageName: 'Dashboard',
    data: {},
  });

  return (
    <AdminPageContext.Provider value={{ pageContext, setPageContext }}>
      {children}
    </AdminPageContext.Provider>
  );
}

export function useAdminPageContext() {
  return useContext(AdminPageContext);
}
