import { Children, isValidElement, type ReactNode } from 'react';

export default function SidebarNavigation({order,children}:{order:string[];children:ReactNode}){
 const rank=(child:ReactNode)=>isValidElement<{name?:string}>(child)&&child.props.name?order.indexOf(child.props.name):-1;
 // Keep reading and keyboard order aligned with the selected visual layout.
 return <div className="sidebar-scroll">{Children.toArray(children).sort((a,b)=>rank(a)-rank(b))}</div>;
}
