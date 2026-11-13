import { Children, isValidElement, type ReactNode } from 'react';

export default function SidebarNavigation({order,children}:{order:string[];children:ReactNode}){
 const arranged=order.filter(n=>n!=="Projects");
 arranged.splice(Math.max(0,arranged.indexOf("General")),0,"Projects");
 const fullOrder=["Marketing","Leads",...arranged.filter(n=>n!=="Marketing"&&n!=="Leads"&&n!=="Research")];
 const components=fullOrder.indexOf("Components");
 fullOrder.splice(components<0?fullOrder.length:components+1,0,"Research");
 const rank=(child:ReactNode)=>isValidElement<{name?:string}>(child)&&child.props.name?fullOrder.indexOf(child.props.name):-1;
 // Keep reading and keyboard order aligned with the selected visual layout.
 return <div className="sidebar-scroll">{Children.toArray(children).sort((a,b)=>rank(a)-rank(b))}</div>;
}
