        const testQuestions = [
            {
                category: "Event Queries",
                question: "whens the next bluebell workshops and whats the cost",
                focus: "Workshop, course, and event scheduling questions",
                expectedType: "advice"
            },
            {
                category: "Event Queries",
                question: "when is the next devon workshop",
                focus: "Workshop, course, and event scheduling questions",
                expectedType: "advice"
            },
            {
                category: "Event Queries",
                question: "what is your next workshop date and where is it",
                focus: "Workshop, course, and event scheduling questions",
                expectedType: "advice"
            },
            {
                category: "Event Queries",
                question: "when are your next Autumn workshops and where are they?",
                focus: "Workshop, course, and event scheduling questions",
                expectedType: "advice"
            },
            {
                category: "Event Queries",
                question: "How long are your workshops?",
                focus: "Workshop, course, and event scheduling questions",
                expectedType: "advice"
            },
            {
                category: "General Queries",
                question: "How much is a residential photography course and does it include B&B",
                focus: "Miscellaneous questions",
                expectedType: "advice"
            },
            {
                category: "General Queries",
                question: "Do you do astrophotography workshops",
                focus: "Miscellaneous questions",
                expectedType: "advice"
            },
            {
                category: "General Queries",
                question: "Can my 14yr old attend your workshop",
                focus: "Miscellaneous questions",
                expectedType: "advice"
            },
            {
                category: "General Queries",
                question: "My pictures never seem sharp.  Can you advise on what I am doing wrong",
                focus: "Miscellaneous questions",
                expectedType: "advice"
            },
            {
                category: "General Queries",
                question: "What types of photography services do you offer?",
                focus: "Miscellaneous questions",
                expectedType: "advice"
            },
            {
                category: "Equipment Recommendations",
                question: "What tripod do you recommend",
                focus: "Equipment advice and recommendations",
                expectedType: "advice"
            },
            {
                category: "Equipment Recommendations",
                question: "What sort of camera do I need for your camera course",
                focus: "Equipment advice and recommendations",
                expectedType: "advice"
            },
            {
                category: "Equipment Recommendations",
                question: "What gear or equipment do I need to bring to a workshop?",
                focus: "Equipment advice and recommendations",
                expectedType: "advice"
            },
            {
                category: "Equipment Recommendations",
                question: "What is the difference between prime and zoom lenses?",
                focus: "Equipment advice and recommendations",
                expectedType: "advice"
            },
            {
                category: "Equipment Recommendations",
                question: "What memory card should I buy?",
                focus: "Equipment advice and recommendations",
                expectedType: "advice"
            },
            {
                category: "Course/Workshop Logistics",
                question: "Do you I get a certificate with the photography course",
                focus: "Course details, requirements, and logistics",
                expectedType: "advice"
            },
            {
                category: "Course/Workshop Logistics",
                question: "Do I need a laptop for the lightroom course",
                focus: "Course details, requirements, and logistics",
                expectedType: "advice"
            },
            {
                category: "Course/Workshop Logistics",
                question: "Is the online photography course really free",
                focus: "Course details, requirements, and logistics",
                expectedType: "advice"
            },
            {
                category: "Course/Workshop Logistics",
                question: "What courses do you offer for complete beginners?",
                focus: "Course details, requirements, and logistics",
                expectedType: "advice"
            },
            {
                category: "Course/Workshop Logistics",
                question: "How many weeks is the beginners’ photography course?",
                focus: "Course details, requirements, and logistics",
                expectedType: "advice"
            },
            {
                category: "Business Information",
                question: "How do I get personalised feedback on my images",
                focus: "Services, policies, contact, and business details",
                expectedType: "advice"
            },
            {
                category: "Business Information",
                question: "How can I contact you or book a discovery call?",
                focus: "Services, policies, contact, and business details",
                expectedType: "advice"
            },
            {
                category: "Business Information",
                question: "Do you offer gift vouchers?",
                focus: "Services, policies, contact, and business details",
                expectedType: "advice"
            },
            {
                category: "Business Information",
                question: "What is your cancellation or refund policy for courses/workshops?",
                focus: "Services, policies, contact, and business details",
                expectedType: "advice"
            },
            {
                category: "Business Information",
                question: "Where is your gallery and can I submit my images for feedback?",
                focus: "Services, policies, contact, and business details",
                expectedType: "advice"
            },
            {
                category: "Technical Photography Concepts",
                question: "What is long exposure and how can I find out more about it",
                focus: "Fundamental photography concepts and definitions",
                expectedType: "advice"
            },
            {
                category: "Technical Photography Concepts",
                question: ""What is the exposure triangle (aperture, shutter, ISO)?"",
                focus: "Fundamental photography concepts and definitions",
                expectedType: "advice"
            },
            {
                category: "Technical Photography Concepts",
                question: ""What is depth of field, and how do I control it?"",
                focus: "Fundamental photography concepts and definitions",
                expectedType: "advice"
            },
            {
                category: "Technical Photography Concepts",
                question: "What is white balance and how do I use it?",
                focus: "Fundamental photography concepts and definitions",
                expectedType: "advice"
            },
            {
                category: "Technical Photography Concepts",
                question: "What is HDR photography?",
                focus: "Fundamental photography concepts and definitions",
                expectedType: "advice"
            },
            {
                category: "Person Queries",
                question: "Who is Alan Ranger and what is his photographic background?",
                focus: "Questions about specific people",
                expectedType: "advice"
            },
            {
                category: "Person Queries",
                question: "Where is Alan Ranger based?",
                focus: "Questions about specific people",
                expectedType: "advice"
            },
            {
                category: "Person Queries",
                question: "Can I hire you as a professional photographer in Coventry?",
                focus: "Questions about specific people",
                expectedType: "advice"
            },
            {
                category: "Person Queries",
                question: "peter orton",
                focus: "Questions about specific people",
                expectedType: "advice"
            },
            {
                category: "Person Queries",
                question: "who is alan ranger",
                focus: "Questions about specific people",
                expectedType: "advice"
            },
            {
                category: "Technical Advice",
                question: "How do I subscribe to the free online photography course?",
                focus: "How-to and troubleshooting photography advice",
                expectedType: "advice"
            },
            {
                category: "Technical Advice",
                question: "How do I improve my composition and storytelling in photos?",
                focus: "How-to and troubleshooting photography advice",
                expectedType: "advice"
            },
            {
                category: "Technical Advice",
                question: "How do I use flash photography?",
                focus: "How-to and troubleshooting photography advice",
                expectedType: "advice"
            },
            {
                category: "Technical Advice",
                question: "How do I edit RAW files?",
                focus: "How-to and troubleshooting photography advice",
                expectedType: "advice"
            },
            {
                category: "Technical Advice",
                question: "How do I improve my photography skills?",
                focus: "How-to and troubleshooting photography advice",
                expectedType: "advice"
            }
        ];