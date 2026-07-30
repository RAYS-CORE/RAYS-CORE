"use client";
import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { validate as uuidValidate } from 'uuid';
import { getCustomTemplateDetails } from "../hooks/useCustomTemplates";
import { getSchemaByTemplateId, getSettingsByTemplateId } from "../presentation-templates";

const SchemaContent = () => {
  const searchParams = useSearchParams();
  const templateID = searchParams.get("group");
  if (!templateID) {
    return <div>No templateID provided</div>;
  }
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({
    description: "",
    ordered: false,
    default: false,
  });
  const isCustomTemplate = templateID.startsWith("custom-") || uuidValidate(templateID);

  useEffect(() => {
    const fetchLayoutsAndSettings = async () => {
      if (isCustomTemplate) {
        const customTemplateDetails = await getCustomTemplateDetails(
          isCustomTemplate ? templateID.startsWith("custom-") ? templateID.split("custom-")[1] : templateID : "",
          isCustomTemplate ? templateID : "",
          "",
        );

        if (customTemplateDetails) {

          setLayout(customTemplateDetails.layouts.map(layout => {
            return {
              id: `custom-${customTemplateDetails.id}:${layout.layoutId}`,
              name: layout.layoutName,
              description: layout.layoutDescription,
              json_schema: layout.schemaJSON,
            }
          }));
          setSettings({
            ...customTemplateDetails.template,
            ordered: false,
            default: false,
          });
        }
      } else {
        const layoutsData = getSchemaByTemplateId(templateID || "");
        const settingsData = getSettingsByTemplateId(templateID || "");
        setLayout(layoutsData);
        setSettings(settingsData || {
          description: "",
          ordered: false,
          default: true,
        });

      }
      setLoading(false);

    };
    fetchLayoutsAndSettings();


  }, [isCustomTemplate]);






  return (
    <div>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div>
          <div data-layouts={JSON.stringify(layout)}>
            <pre>{JSON.stringify(layout, null, 2)}</pre>\
          </div>
          <div data-settings={JSON.stringify(settings)}>
            <pre>{JSON.stringify(settings, null, 2)}</pre>
          </div>
        </div>
      )}


    </div>
  );
};

const page = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SchemaContent />
    </Suspense>
  );
};

export default page;
