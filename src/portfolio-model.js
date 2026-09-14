const companyImages={"loyal": "/assets/vcxx/loyal.png", "figure": "/assets/vcxx/figure.png", "inspectify": "/assets/vcxx/inspectify.png", "gumloop": "/assets/vcxx/gumloop.ico", "ditto": "/assets/vcxx/ditto.jpg", "omni": "/assets/vcxx/omni.png", "hightouch": "/assets/vcxx/hightouch.ico", "vanta": "/assets/vcxx/vanta.png", "flock": "/assets/vcxx/flock.png", "anduril": "/assets/vcxx/anduril.png", "anthropic": "/assets/vcxx/anthropic.png", "openai": "/assets/vcxx/openai.png", "databricks": "/assets/vcxx/databricks.png", "ramp": "/assets/vcxx/ramp.png", "epic": "/assets/vcxx/epic.svg", "canva": "/assets/vcxx/canva.png", "fivetran": "/assets/vcxx/fivetran.png", "immuta": "/assets/vcxx/immuta.jpg", "spacex": "/assets/vcxx/spacex.ico"};
// Research data is fund exposure, never a Capital or personal holding.
export const startupFund = Object.freeze({
 name:'Fundrise Innovation Fund', ticker:'VCX', token:'VCXx',
 reportedAt:'2026-06-30', checkedAt:'2026-09-13',
 productUrl:'https://assets.backed.fi/products/fundrise-innovation-fund-llc-xstock',
 fundUrl:'https://fundrise.com/vcx',
 holdingsUrl:'https://www.sec.gov/Archives/edgar/data/1867090/000186709026000109/04400.htm',
 metadataUrl:'https://api.xstocks.fi/api/v2/public/assets/VCXx',
 chainId:1,network:'Ethereum',decimals:18,address:'0xbac2588d2272ff6e5826e2882042fa2926039cba',
 companies:[
 ['loyal','Loyal','Health & longevity','1–2%',true,'https://loyal.com/','Developing medicines intended to help dogs live longer, healthier lives.','Clinical-stage veterinary biotech.'],
 ['figure','Figure','Robotics & defense','1–2%',true,'https://www.figure.ai/','Humanoid robots designed to perform physical work in human environments.','Robotics, perception and embodied AI.'],
 ['gumloop','Gumloop','AI & infrastructure','<0.1%',true,'https://www.gumloop.com/','AI agents and workflow automation that connect everyday business tools.','A very small position in the disclosed fund portfolio.'],
 ['inspectify','Inspectify','Property technology','<1%',true,'https://www.inspectify.com/','Property inspections and structured data for real-estate decisions.','Inspection operations meet property intelligence.'],
 ['ditto','Ditto','Software & data','<1%',true,'https://www.ditto.com/','Software that lets devices work with data offline and synchronize when connected.','Built for apps that cannot depend on constant connectivity.'],
 ['fluidstack','Fluidstack','AI & infrastructure','2–5%',true,'https://www.fluidstack.io/','Cloud computing infrastructure for training and running AI models.','The computing layer behind large-scale AI.'],
 ['omni','Omni','Software & data','<1%',true,'https://omni.co/','Business intelligence tools for exploring data, building dashboards and sharing analysis.','A shared analytics layer for business teams.'],
 ['hightouch','Hightouch','Software & data','<1%',true,'https://hightouch.com/','Connects customer data to marketing tools and personalized campaigns.','Customer data activation and composable software.'],
 ['vanta','Vanta','Software & data','1–2%',true,'https://www.vanta.com/','Automates security compliance checks, evidence collection and trust workflows.','Security assurance for growing companies.'],
 ['flock','Flock Safety','Robotics & defense','2–5%',true,'https://www.flocksafety.com/','Connected cameras, license-plate readers and investigation software for public safety.','Hardware and software for real-world operations.'],
 ['immuta','Immuta','Software & data','<1%',true,'https://www.immuta.com/','Data access and security tools that help organizations control sensitive information.','Governance for enterprise data.'],
 ['fivetran','Fivetran','Software & data','1–2%',true,'https://www.fivetran.com/','Automated data movement from business applications into analytics platforms.','Pipelines that keep company data connected.'],
 ['anduril','Anduril','Robotics & defense','2–5%',false,'https://www.anduril.com/','Autonomous defense systems connecting sensors, software and hardware.','Defense technology built around the Lattice platform.'],
 ['anthropic','Anthropic','AI & infrastructure','>20%',false,'https://www.anthropic.com/','AI research and products including the Claude family of models.','One of the largest disclosed fund exposures.'],
 ['openai','OpenAI','AI & infrastructure','10–20%',false,'https://openai.com/','AI research, models and products including ChatGPT.','One of the largest disclosed fund exposures.'],
 ['databricks','Databricks','Software & data','10–20%',false,'https://www.databricks.com/','A platform for data engineering, analytics and enterprise AI.','Data and AI infrastructure for organizations.'],
 ['ramp','Ramp','Finance','2–5%',false,'https://ramp.com/','Corporate cards, expense management, bill payments and finance automation.','A software platform for business spending.'],
 ['spacex','SpaceX','Space','2–5%',false,'https://www.spacex.com/','Launch systems, spacecraft and satellite connectivity.','Space Exploration Technologies in the fund disclosure.'],
 ['epic','Epic Games','Gaming & design','2–5%',false,'https://www.epicgames.com/','Games and development technology including Fortnite and Unreal Engine.','Interactive entertainment and creator tools.'],
 ['canva','Canva','Gaming & design','1–2%',false,'https://www.canva.com/','Visual design and collaboration software for people and organizations.','Tools for presentations, content and visual communication.']
 ].map(([id,name,category,weight,niche,website,description,detail])=>Object.freeze({id,name,category,weight,niche,website,description,detail,image:companyImages[id]||null}))
});
export function filterFundCompanies({query='',sector='All',niche=false}={}){
 const q=query.trim().toLocaleLowerCase();
 return startupFund.companies.filter(c=>(!niche||c.niche)&&(sector==='All'||c.category===sector)&&[c.name,c.category,c.description].join(' ').toLocaleLowerCase().includes(q));
}

