import Link from "next/link";
import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type BreadcrumbItemData = { label: string; href?: string };

export function PublicBreadcrumbs({ items }: { items: BreadcrumbItemData[] }) {
  return <Breadcrumb>
    <BreadcrumbList>
      {items.map((item, index) => <Fragment key={`${item.href ?? "page"}-${item.label}`}>
        {index ? <BreadcrumbSeparator /> : null}
        <BreadcrumbItem>
          {item.href ? <BreadcrumbLink asChild><Link href={item.href}>{item.label}</Link></BreadcrumbLink> : <BreadcrumbPage>{item.label}</BreadcrumbPage>}
        </BreadcrumbItem>
      </Fragment>)}
    </BreadcrumbList>
  </Breadcrumb>;
}
