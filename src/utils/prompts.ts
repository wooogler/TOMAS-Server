import {
  AIChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "langchain/schema";

export type Prompt = {
  role: "SYSTEM" | "HUMAN" | "AI";
  content: string;
};

export const makePromptMessages = (prompts: Prompt[]) => {
  const promptMessages = prompts.map((prompt) => {
    if (prompt.role === "HUMAN") {
      return new HumanChatMessage(prompt.content);
    } else if (prompt.role === "AI") {
      return new AIChatMessage(prompt.content);
    } else {
      return new SystemChatMessage(prompt.content);
    }
  });

  return promptMessages;
};

export const findComponentPrompts: Prompt[] = [
  {
    role: "SYSTEM",
    content: `You are a React developer. You read the HTML code of a legacy website and want to organize it by purpose into several large React components. Each component has an attribute called i, which is equal to the value of i in the top-level tag that the component contains. List your React components as follows:

    <{Component name} i="{i}">
    {Description of the UI included in the component over 50 words.}
    </{Component name}>`,
  },
  {
    role: "HUMAN",
    content: `<html><body><header i="72"><div i="73"><button type="button" aria-label="Open main site navigation" onclick="togglePanel()" id="open-burger-menu-button" class="flix-header-burger-menu__toggle flix-btn flix-btn--link flix-btn--square flix-btn--md" aria-controls="menu-panel" aria-expanded="false" i="157"></button></div></header><main i="271"><div i="272"><div i="279"><h1 i="280">Affordable bus travel from Greyhound</h1><div i="281"><div i="306"><div i="307"><fieldset i="308"><div i="309"><label i="312">One Way</label></div><div i="313"><label i="316">Round Trip</label></div></fieldset></div><div i="317"><div i="318"><div i="319"><label i="320"><div i="321">From</div></label><div i="322"><input id="searchInputMobile-from" type="button" class="hcr-input__field-7-6-0" aria-errormessage="infoError-searchInputMobile-from" role="button" readonly="" aria-label="Departing from Los Angeles, CA" value="Los Angeles, CA" i="326"></div></div></div><button type="button" class="hcr-btn-7-6-0 hcr-btn--square-7-6-0 hcr-btn--sm-7-6-0 cVoiG" aria-label="Swap departure and arrival location" i="341"></button><div i="345"><div i="346"><label i="347"><div i="348">To</div></label><div i="349"><input id="searchInputMobile-to" type="button" class="hcr-input__field-7-6-0" aria-errormessage="infoError-searchInputMobile-to" role="button" readonly="" aria-label="Arriving at Las Vegas, NV" value="Las Vegas, NV" i="353"></div></div></div></div><div i="368"><div i="372"><label i="373"><div i="374">Departure</div></label><div i="375"><input id="dateInput-from" type="button" class="hcr-input__field-7-6-0" aria-errormessage="infoError-dateInput-from" aria-label="Change departure date Thu, Jun 29" tabindex="0" aria-controls="dialog-date-from" aria-expanded="false" value="Thu, Jun 29" i="379"></div></div></div><div i="384"><div i="387"><label i="388"><div i="389">Passengers</div></label><div i="390"><input id="productSummary" type="button" class="hcr-input__field-7-6-0" aria-errormessage="infoError-productSummary" aria-label="1 Adult, Add passengers" aria-controls="dialog-products" aria-expanded="false" value="1 Person" i="391"></div></div></div><div i="398"><button type="button" class="hcr-btn-7-6-0 hcr-btn--primary-7-6-0 lKKy1" aria-label="Search trips" i="399">Search</button></div></div></div></div></div><div i="400"><div i="402"><div i="403"><span i="407"> Manage My Booking </span></div><div i="408"><span i="412"> Bus Tracker </span></div><div i="413"><span i="417"> Help </span></div></div></div><section i="420"><div i="421"><div i="422"><div i="423"><div i="427"><h2 i="428">More travel options</h2><div i="429">You now can select from more schedules across U.S., Mexico and Canada with Greyhound and FlixBus.</div><a href="/new" i="430"><span i="431">Explore now</span></a></div></div><div i="433"><div i="437"><h2 i="438">Enjoy free onboard entertainment</h2><div i="439">Watch a FREE movie and use our power outlets to stay powered up during your trip.</div><a href="/travel-info/onboard-entertainment" i="440"><span i="441">Find out what’s playing</span></a></div></div><div i="443"><div i="447"><h2 i="448">Reserve a Seat</h2><div i="449">Reserve your favorite seat when you book your ticket.</div><a href="/travel-info/seat-reservations" i="450"><span i="451">Window or Aisle?</span></a></div></div><div i="453"><div i="457"><h2 i="458">Need to make a change?</h2><div i="459">Easily change your ticket or add bags with Manage My Booking.</div><a href="/manage-my-booking" i="460"><span i="461">Discover all your options</span></a></div></div></div></div></section><div i="463"><div i="468"><h2 i="469">Discover all the places you can go</h2><p i="470">Choose from almost 2,300 destinations with Greyhound, FlixBus and our connecting partners!</p><button tabindex="-1" type="button" class="flix-btn flix-btn--link exploration-map-teaser-button" i="471">Explore the map</button></div></div><div i="473"><div i="476"><p i="477">Greyhound connects thousands of communities across North America by providing <strong i="478">convenient, comfortable and affordable bus travel</strong>.</p><p i="479">With almost <strong i="480">2,300 destinations</strong> across the U.S., Canada and Mexico, Greyhound helps you travel when you want, from where you want. Leave from big cities like <strong i="481"><a href="https://www.greyhound.com/en-us/bus-to-new-york" i="482">New York</a>, <a href="https://www.greyhound.com/en-us/bus-to-chicago" i="483">Chicago</a>, <a href="https://www.greyhound.com/en-us/bus-to-atlanta" i="484">Atlanta</a></strong> or from smaller cities like <strong i="485"><a href="https://www.greyhound.com/en-us/bus-to-omaha" i="486">Omaha</a>, <a href="https://www.greyhound.com/en-us/bus-to-el-paso" i="487">El Paso</a>, <a href="https://www.greyhound.com/en-us/bus-to-albany-3" i="488">Albany</a></strong>.Big or small, we’ve got your covered.</p><p i="489">Whether you’re booking online or using our <a href="/mobile-app" i="490">Greyhound app</a> we’ve made planning your bus trip easy. You can find ticket prices, up to date bus schedules and bus station information all in one place. Then when you’re ready to travel you can buy your bus ticket online and keep your ticket on your smartphone, so no need to print it out!</p><p i="491">With Greyhound you can always <strong i="492">travel stress-free</strong>. <a href="/track" i="493">Track My Bus</a> gives you real-time bus stop information and up to date bus timetables. Just add your line number or confirmation number and you can stay up to date on your journey.</p><p i="494">Onboard, sit back in our all leather, reclining seats while you’re enjoying our <strong i="495">free <a href="/travel-info/onboard-entertainment" i="496">onboard entertainment</a></strong> (Movies, Games, TV!) or surfing our <strong i="497">free Wi-Fi</strong>. Stay charged with in seat power ports.</p></div></div><div i="498"><div i="501"><h2 i="502">Discover popular bus routes</h2>
<ul i="503"><li i="504"><a href="/en-us/bus-from-atlantic-city-to-new-york" i="505">Atlantic City NJ to New York NY</a></li><li i="506"><a href="/en-us/bus-from-new-york-to-philadelphia" i="507">New York NY to Philadelphia PA</a></li><li i="508"><a href="/en-us/bus-from-albany-3-to-new-york" i="509">Albany NY to Ney York NY</a></li><li i="510"><a href="/en-us/bus-from-boston-to-new-york" i="511">Boston MA to New York NY</a></li><li i="512"><a href="/en-us/bus-from-new-york-to-syracuse-1" i="513">New York NY to Syracuse NY</a></li><li i="514"><a href="/en-us/bus-from-las-vegas-1-to-los-angeles" i="515">Las Vegas NV to Los Angeles CA</a></li><li i="516"><a href="/en-us/bus-from-binghamton-to-new-york" i="517">Binghamton NY to New York NY</a></li><li i="518"><a href="/en-us/bus-from-baltimore-to-new-york" i="519">Baltimore MD to New York NY</a></li><li i="520"><a href="/en-us/bus-from-dallas-to-houston" i="521">Dallas TX to Houston TX</a></li><li i="522"><a href="/en-us/bus-from-new-york-to-washington-2" i="523">New York NY to Washington DC</a></li><li i="524"><a href="/en-us/bus-from-monterrey-to-nuevo-laredo" i="525">Monterrey MX to Nuevo Laredo MX</a></li><li i="526"><a href="/en-us/bus-from-buffalo-to-new-york" i="527">Buffalo NY to New York NY</a></li><li i="528"><a href="/en-us/bus-from-chicago-to-minneapolis" i="529">Chicago IL to Minneapolis MN</a></li><li i="530"><a href="/en-us/bus-from-houston-to-san-antonio" i="531">Houston TX to San Antonio TX</a></li><li i="532"><a href="/en-us/bus-from-los-angeles-to-phoenix" i="533">Los Angeles CA to Phoenix AZ</a></li><li i="534"><a href="/en-us/bus-from-new-york-to-montreal" i="535">New York NY to Montreal QC</a></li><li i="536"><a href="/en-us/bus-from-miami-to-orlando" i="537">Miami FL to Orlando FL</a></li><li i="538"><a href="/en-us/bus-from-los-angeles-to-san-diego-1" i="539">Los Angeles CA to San Diego CA</a></li><li i="540"><a href="/en-us/bus-from-toronto-to-new-york" i="541">Toronto ON to New York NY</a></li><li i="542"><a href="/en-us/bus-from-vancouver-to-seattle" i="543">Vancouver BC to Seattle WA</a></li></ul></div></div></main><footer i="545"><div i="546"><div i="548"><div i="549"><button class="footer-btn-nav" type="button" aria-expanded="false" style="cursor: auto;" i="552">Bus Travel</button></div><div i="564"><button class="footer-btn-nav" type="button" aria-expanded="false" style="cursor: auto;" i="567">Discover</button></div><div i="581"><button class="footer-btn-nav" type="button" aria-expanded="false" style="cursor: auto;" i="584">Greyhound</button></div><div i="602"><button class="footer-btn-nav" type="button" aria-expanded="false" style="cursor: auto;" i="605">Customer Service</button></div></div></div><div i="619"><div i="621"><div i="622"><h4 i="623">Greyhound App</h4></div><div i="628"><h4 i="629">Greyhound on:</h4></div></div></div><div i="649"><div i="654"><div i="655"><a href="/legal" i="656">Legal</a><a href="https://www.greyhound.com/privacy-policy" i="657">Privacy Policy</a><a href="/copyright" i="658">Copyright</a><a i="659">Your Privacy Choices</a></div><div i="660">© 2023 Greyhound Lines, Inc.</div></div></div></footer></body></html>`,
  },
  {
    role: "AI",
    content: `<Header i="72">
    The header component contains a button that toggles the main site navigation panel. It has an ID, class, and onclick event handler. The button is used to open and close the navigation panel.
    </Header>
    
    <Main i="271">
    The main component contains a form for searching bus trips. It includes input fields for selecting the departure and arrival locations, date, and number of passengers. There is also a search button to submit the form.
    </Main>
    
    <Navigation i="400">
    The navigation component contains links for managing bookings, tracking buses, and getting help. These links provide additional functionality and information for users.
    </Navigation>
    
    <TravelOptions i="420">
    The travel options component displays information about additional travel options available with Greyhound and FlixBus. It includes a link to explore more options.
    </TravelOptions>
    
    <Map i="463">
    The map component encourages users to explore all the places they can go with Greyhound. It includes a button to view an interactive map.
    </Map>
    
    <AboutGreyhound i="473">
    The about Greyhound component provides information about Greyhound's services, destinations, and booking process. It highlights features such as onboard entertainment and free Wi-Fi.
    </AboutGreyhound>
    
    <PopularRoutes i="498">
    The popular routes component displays a list of popular bus routes with links to more information about each route. It helps users discover popular travel destinations.
    </PopularRoutes>
    
    <Footer i="545">
    The footer component contains navigation buttons for different sections of the website, such as bus travel, discovery, Greyhound, and customer service. It also includes links to the Greyhound app and social media platforms.
    </Footer>`,
  },
];
