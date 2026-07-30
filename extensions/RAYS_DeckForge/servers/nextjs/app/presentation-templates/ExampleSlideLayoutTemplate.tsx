import * as z from "zod";
// Note:
// If you want to use images and icons, you must use ImageSchema and IconSchema
// Images and icons are the only media types supported for PDF and PPTX exports
import { ImageSchema, IconSchema } from "@/app/presentation-templates/defaultSchemes";


// Schema definition
export const Schema = z.object({
    // Notes:
    // Schema fields
    // Each field must have a default value (this is important for Layout Preview)
    // Each field must have a meta description
    // Each field must have a minimum and maximum length
    // Each array field must have a minimum and maximum number of items
})

// Type inference
type SchemaType = z.infer<typeof Schema>;


// Component definition
const SlideComponent = ({ data }: { data: Partial<SchemaType> }) => {
    // Notes: 
    // Must have consistent aspect ratio (16:9) and max-width of 1280px.
    // Validate each data field before rendering using && operator or optional chaining.
    // These layouts are exported as PDF and PPTX so they must be optimized for both formats.
    // Content must properly fit in the container, specify min and max constraints in the schema.
    // You can check out ExampleSlideLayout.tsx for more details.
};

export default SlideComponent;